import { type NextRequest, NextResponse } from "next/server";
import { updateMemoStatusSchema } from "@/dto";
import { auth } from "@/lib/auth";
import { memoService } from "@/services";

// PATCH /api/memos/[id]/status - Update memo status
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

    // Check ownership
    const existingMemo = await memoService.getMemoById(id);
    if (!existingMemo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    if (existingMemo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateMemoStatusSchema.parse(body);

    const memo = await memoService.updateMemoStatus(id, data);

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
