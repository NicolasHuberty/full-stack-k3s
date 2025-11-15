import { type NextRequest, NextResponse } from "next/server";
import { updateMemoSchema } from "@/dto";
import { auth } from "@/lib/auth";
import { memoService } from "@/services";

// GET /api/memos/[id] - Get memo by ID (only if user owns it or it's shared via team)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeFiles = searchParams.get("includeFiles") === "true";

    const memo = await memoService.getMemoById(id, includeFiles);

    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    // Check if user owns the memo or has access through team
    if (memo.userId !== session.user.id) {
      // TODO: Check if user has access through team
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ data: memo });
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

// PATCH /api/memos/[id] - Update memo (only if user owns it)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership before updating
    const existingMemo = await memoService.getMemoById(id);
    if (!existingMemo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    if (existingMemo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateMemoSchema.parse(body);

    const memo = await memoService.updateMemo(id, data);

    // Log status change
    if (data.status) {
      console.log(`[API] Memo ${id} status changed to: ${data.status}`);
    }

    return NextResponse.json({ data: memo });
  } catch (error) {
    console.error(`[API] Failed to update memo ${(await params).id}:`, error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/memos/[id] - Delete memo (only if user owns it)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Get authenticated user
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership before deleting
    const existingMemo = await memoService.getMemoById(id);
    if (!existingMemo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    if (existingMemo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await memoService.deleteMemo(id);

    return NextResponse.json({ message: "Memo deleted" });
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
