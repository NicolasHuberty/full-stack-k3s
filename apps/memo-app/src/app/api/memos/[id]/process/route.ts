import { type NextRequest, NextResponse } from "next/server";
import { addFileProcessJob } from "@/lib/queue";
import { auth } from "@/lib/auth";
import { memoService } from "@/services";

export const runtime = "nodejs";

// POST /api/memos/[id]/process - Process text memo with AI
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

    // Get memo to verify it exists and get content
    const memo = await memoService.getMemoById(id);

    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    // Check ownership
    if (memo.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!memo.content || memo.content.trim().length === 0) {
      return NextResponse.json(
        { error: "Memo has no content to process" },
        { status: 400 },
      );
    }

    // Queue AI processing job for text memo
    const job = await addFileProcessJob({
      fileId: "", // No file for text memos
      s3Key: "", // No S3 key for text memos
      mimeType: "text/plain",
      operation: "transcribe", // Reuse transcribe operation for text processing
      memoId: id,
    });

    return NextResponse.json({
      success: true,
      message: "AI processing job queued",
      jobId: job.id,
    });
  } catch (error) {
    console.error("AI processing queue error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
