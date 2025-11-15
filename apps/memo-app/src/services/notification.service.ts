import { NotificationType } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

export class NotificationService {
  /**
   * Create notification for missing required fields
   */
  async createMissingFieldsNotification(
    userId: string,
    memoId: string,
    missingFields: string[],
  ) {
    const memo = await prisma.memo.findUnique({
      where: { id: memoId },
      include: {
        form: {
          select: {
            name: true,
            fields: {
              where: {
                name: {
                  in: missingFields,
                },
              },
              select: {
                name: true,
                label: true,
              },
            },
          },
        },
      },
    });

    if (!memo || !memo.form) {
      return;
    }

    const fieldLabels = memo.form.fields.map((f) => f.label).join(", ");

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.MISSING_FIELD,
        title: "Missing Required Fields",
        message: `Your memo "${memo.title}" is missing the following required fields: ${fieldLabels}`,
        data: {
          memoId,
          missingFields,
          formName: memo.form.name,
        },
      },
    });

    // TODO: Send email notification
    // await this.sendEmail(userId, notification);

    return notification;
  }

  /**
   * Create team invitation notification
   */
  async createTeamInviteNotification(
    userId: string,
    teamId: string,
    invitedBy: string,
  ) {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
    });

    const inviter = await prisma.user.findUnique({
      where: { id: invitedBy },
      select: { name: true },
    });

    if (!team || !inviter) {
      return;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.TEAM_INVITE,
        title: "Team Invitation",
        message: `${inviter.name} invited you to join the team "${team.name}"`,
        data: {
          teamId,
          invitedBy,
        },
      },
    });

    return notification;
  }

  /**
   * Create memo shared notification
   */
  async createMemoSharedNotification(
    userId: string,
    memoId: string,
    sharedBy: string,
    teamName: string,
  ) {
    const memo = await prisma.memo.findUnique({
      where: { id: memoId },
      select: { title: true },
    });

    const sharer = await prisma.user.findUnique({
      where: { id: sharedBy },
      select: { name: true },
    });

    if (!memo || !sharer) {
      return;
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: NotificationType.MEMO_SHARED,
        title: "Memo Shared",
        message: `${sharer.name} shared a memo "${memo.title}" with team ${teamName}`,
        data: {
          memoId,
          sharedBy,
          teamName,
        },
      },
    });

    return notification;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, unreadOnly = false) {
    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        read: unreadOnly ? false : undefined,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        read: true,
      },
    });

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string) {
    await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });
  }
}

export const notificationService = new NotificationService();
