import { type NextRequest, NextResponse } from "next/server";
import { checkQueueHealth } from "@/lib/queue";

// GET /api/queue/health - Check queue system health
export async function GET(_request: NextRequest) {
  try {
    const health = await checkQueueHealth();

    return NextResponse.json(health);
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
