import { type NextRequest, NextResponse } from "next/server";
import { attachFilesSchema } from "@/dto";
import { auth } from "@/lib/auth";
import { fileService, memoService } from "@/services";

// GET /api/memos/[id]/files - Get files attached to memo
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

    // Check ownership
    const memo = await memoService.getMemoById(id);
    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const files = await fileService.getFilesByMemoId(id);

    return NextResponse.json({ data: files });
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

// POST /api/memos/[id]/files - Attach files to memo
export async function POST(
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
    const memo = await memoService.getMemoById(id);
    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = attachFilesSchema.parse(body);

    await memoService.attachFiles(id, data);

    return NextResponse.json({ message: "Files attached successfully" });
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
