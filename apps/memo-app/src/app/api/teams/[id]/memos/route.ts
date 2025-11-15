import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { teamService } from "@/services/team.service";

// GET /api/teams/[id]/memos - Get all memos shared with team
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
    const memos = await teamService.getTeamMemos(id, session.user.id);

    return NextResponse.json({ data: memos });
  } catch (error) {
    console.error("Get team memos error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get team memos",
      },
      { status: 500 },
    );
  }
}

// POST /api/teams/[id]/memos - Share memo with team
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
    const { memoId } = body;

    if (!memoId) {
      return NextResponse.json(
        { error: "Memo ID is required" },
        { status: 400 },
      );
    }

    const teamMemo = await teamService.shareMemoWithTeam(
      memoId,
      id,
      session.user.id,
    );

    return NextResponse.json({ data: teamMemo }, { status: 201 });
  } catch (error) {
    console.error("Share memo error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to share memo",
      },
      { status: 500 },
    );
  }
}
