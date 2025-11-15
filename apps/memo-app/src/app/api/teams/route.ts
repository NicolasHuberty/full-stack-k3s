import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { teamService } from "@/services/team.service";

// GET /api/teams - Get all teams for current user
export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teams = await teamService.getUserTeams(session.user.id);

    return NextResponse.json({ data: teams });
  } catch (error) {
    console.error("Get teams error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get teams" },
      { status: 500 },
    );
  }
}

// POST /api/teams - Create new team
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Team name is required" },
        { status: 400 },
      );
    }

    const team = await teamService.createTeam(
      session.user.id,
      name,
      description,
    );

    return NextResponse.json({ data: team }, { status: 201 });
  } catch (error) {
    console.error("Create team error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to create team",
      },
      { status: 500 },
    );
  }
}
