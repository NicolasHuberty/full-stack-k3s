import { NextRequest, NextResponse } from "next/server";
import { memoService, fileService } from "@/services";
import { attachFilesSchema } from "@/dto";

// GET /api/memos/[id]/files - Get files attached to memo
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const files = await fileService.getFilesByMemoId(id);

    return NextResponse.json({ data: files });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/memos/[id]/files - Attach files to memo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const data = attachFilesSchema.parse(body);

    await memoService.attachFiles(id, data);

    return NextResponse.json({ message: "Files attached successfully" });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
