import { TeamRole } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export class TeamService {
  /**
   * Create a new team
   */
  async createTeam(userId: string, name: string, description?: string) {
    const team = await prisma.team.create({
      data: {
        name,
        description,
        members: {
          create: {
            userId,
            role: TeamRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return team;
  }

  /**
   * Get team by ID
   */
  async getTeam(teamId: string, userId: string) {
    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            memos: true,
            forms: true,
          },
        },
      },
    });

    return team;
  }

  /**
   * Get all teams for a user
   */
  async getUserTeams(userId: string) {
    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
        _count: {
          select: {
            memos: true,
            forms: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return teams;
  }

  /**
   * Update team
   */
  async updateTeam(
    teamId: string,
    userId: string,
    data: { name?: string; description?: string },
  ) {
    // Check if user is owner or admin
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: {
          in: [TeamRole.OWNER, TeamRole.ADMIN],
        },
      },
    });

    if (!member) {
      throw new Error("Unauthorized: Only owners and admins can update teams");
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data,
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
          },
        },
      },
    });

    return team;
  }

  /**
   * Delete team
   */
  async deleteTeam(teamId: string, userId: string) {
    // Check if user is owner
    const member = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: TeamRole.OWNER,
      },
    });

    if (!member) {
      throw new Error("Unauthorized: Only owners can delete teams");
    }

    await prisma.team.delete({
      where: { id: teamId },
    });
  }

  /**
   * Add member to team
   */
  async addMember(
    teamId: string,
    userId: string,
    newMemberEmail: string,
    role: TeamRole = TeamRole.MEMBER,
  ) {
    // Check if requester is owner or admin
    const requester = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: {
          in: [TeamRole.OWNER, TeamRole.ADMIN],
        },
      },
    });

    if (!requester) {
      throw new Error("Unauthorized: Only owners and admins can add members");
    }

    // Find user by email
    const newMember = await prisma.user.findUnique({
      where: { email: newMemberEmail },
    });

    if (!newMember) {
      throw new Error("User not found");
    }

    // Check if already a member
    const existing = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: newMember.id,
          teamId,
        },
      },
    });

    if (existing) {
      throw new Error("User is already a member of this team");
    }

    const teamMember = await prisma.teamMember.create({
      data: {
        teamId,
        userId: newMember.id,
        role,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return teamMember;
  }

  /**
   * Remove member from team
   */
  async removeMember(teamId: string, userId: string, memberToRemove: string) {
    // Check if requester is owner or admin
    const requester = await prisma.teamMember.findFirst({
      where: {
        teamId,
        userId,
        role: {
          in: [TeamRole.OWNER, TeamRole.ADMIN],
        },
      },
    });

    if (!requester) {
      throw new Error(
        "Unauthorized: Only owners and admins can remove members",
      );
    }

    // Cannot remove owner
    const memberData = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: memberToRemove,
          teamId,
        },
      },
    });

    if (memberData?.role === TeamRole.OWNER) {
      throw new Error("Cannot remove team owner");
    }

    await prisma.teamMember.delete({
      where: {
        userId_teamId: {
          userId: memberToRemove,
          teamId,
        },
      },
    });
  }

  /**
   * Share memo with team
   */
  async shareMemoWithTeam(memoId: string, teamId: string, userId: string) {
    // Check if user is member of team
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!member) {
      throw new Error("You must be a member of this team");
    }

    // Check if user owns the memo
    const memo = await prisma.memo.findFirst({
      where: {
        id: memoId,
        userId,
      },
    });

    if (!memo) {
      throw new Error("Memo not found or you don't have permission");
    }

    // Share memo with team
    const teamMemo = await prisma.teamMemo.create({
      data: {
        teamId,
        memoId,
      },
    });

    return teamMemo;
  }

  /**
   * Get memos shared with team
   */
  async getTeamMemos(teamId: string, userId: string) {
    // Check if user is member of team
    const member = await prisma.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId,
          teamId,
        },
      },
    });

    if (!member) {
      throw new Error("You must be a member of this team");
    }

    const memos = await prisma.memo.findMany({
      where: {
        teams: {
          some: {
            teamId,
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        form: {
          select: {
            id: true,
            name: true,
          },
        },
        formData: true,
        _count: {
          select: {
            memoFiles: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return memos;
  }
}

export const teamService = new TeamService();
