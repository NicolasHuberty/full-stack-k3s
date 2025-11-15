import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { teamService } from "@/services/team.service";

// GET /api/teams/[id] - Get team by ID
export async function GET(
  _request: NextRequest,
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
    const team = await teamService.getTeam(id, session.user.id);

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({ data: team });
  } catch (error) {
    console.error("Get team error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get team" },
      { status: 500 },
    );
  }
}

// PATCH /api/teams/[id] - Update team
export async function PATCH(
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

    const team = await teamService.updateTeam(id, session.user.id, body);

    return NextResponse.json({ data: team });
  } catch (error) {
    console.error("Update team error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update team",
      },
      { status: 500 },
    );
  }
}

// DELETE /api/teams/[id] - Delete team
export async function DELETE(
  _request: NextRequest,
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
    await teamService.deleteTeam(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete team error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete team",
      },
      { status: 500 },
    );
  }
}
