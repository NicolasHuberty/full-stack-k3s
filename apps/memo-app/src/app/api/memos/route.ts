import { type NextRequest, NextResponse } from "next/server";
import { createMemoSchema, memoFiltersSchema } from "@/dto";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { memoService } from "@/services";

// GET /api/memos - Get all memos with filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const filters = memoFiltersSchema.parse({
      userId: searchParams.get("userId") || undefined,
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
    const body = await request.json();
    const data = createMemoSchema.parse(body);

    // Use default user ID if not provided (for demo without auth)
    const memo = await memoService.createMemo({
      ...data,
      userId: data.userId || DEFAULT_USER_ID,
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
