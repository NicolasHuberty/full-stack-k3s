import { type NextRequest, NextResponse } from "next/server";
import { updateMemoSchema } from "@/dto";
import { memoService } from "@/services";

// GET /api/memos/[id] - Get memo by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeFiles = searchParams.get("includeFiles") === "true";

    const memo = await memoService.getMemoById(id, includeFiles);

    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
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

// PATCH /api/memos/[id] - Update memo
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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

// DELETE /api/memos/[id] - Delete memo (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
