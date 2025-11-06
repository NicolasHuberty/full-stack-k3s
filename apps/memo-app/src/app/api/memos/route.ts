import { type NextRequest, NextResponse } from "next/server";
import { createMemoSchema, memoFiltersSchema } from "@/dto";
import { auth } from "@/lib/auth";
import { memoService } from "@/services";

// GET /api/memos - Get all memos with filters
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Always filter by current user's ID
    console.log("[API] Session user ID:", session.user.id);
    console.log("[API] Session user:", JSON.stringify(session.user));
    const filters = memoFiltersSchema.parse({
      userId: session.user.id, // Use authenticated user's ID
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!, 10)
        : 20,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!, 10)
        : 0,
    });

    const memos = await memoService.getMemos(filters);

    return NextResponse.json({ data: memos });
  } catch (error) {
    console.error("[API] Error fetching memos:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/memos - Create a new memo
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = createMemoSchema.parse(body);

    // Create memo for authenticated user
    const memo = await memoService.createMemo({
      ...data,
      userId: session.user.id,
    });

    return NextResponse.json({ data: memo }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
