import { type NextRequest, NextResponse } from "next/server";
import { createMemoSchema, memoFiltersSchema } from "@/dto";
import { auth } from "@/lib/auth";
import { memoService } from "@/services";

// GET /api/memos - Get all memos with filters (only user's own memos + team memos)
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get("limit");
    const offsetParam = searchParams.get("offset");

    const filters = memoFiltersSchema.parse({
      userId: session.user.id, // Always filter by current user
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      limit: limitParam ? parseInt(limitParam, 10) : 20,
      offset: offsetParam ? parseInt(offsetParam, 10) : 0,
    });

    const memos = await memoService.getMemos(filters);

    return NextResponse.json({ data: memos });
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

    // Always use authenticated user's ID
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
