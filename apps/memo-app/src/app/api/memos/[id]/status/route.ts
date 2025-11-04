import { type NextRequest, NextResponse } from "next/server";
import { updateMemoStatusSchema } from "@/dto";
import { memoService } from "@/services";

// PATCH /api/memos/[id]/status - Update memo status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
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
