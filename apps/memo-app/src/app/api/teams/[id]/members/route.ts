import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { TeamRole } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import { teamService } from "@/services/team.service";

// POST /api/teams/[id]/members - Add member to team
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { email, role } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const member = await teamService.addMember(
      id,
      session.user.id,
      email,
      role || TeamRole.MEMBER,
    );

    return NextResponse.json({ data: member }, { status: 201 });
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add member",
      },
      { status: 500 },
    );
  }
}
