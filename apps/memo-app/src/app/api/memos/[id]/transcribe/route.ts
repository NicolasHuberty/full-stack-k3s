import { type NextRequest, NextResponse } from "next/server";
import { addFileProcessJob } from "@/lib/queue";
import { auth } from "@/lib/auth";
import { fileService, memoService } from "@/services";

export const runtime = "nodejs";

// POST /api/memos/[id]/transcribe - Transcribe all audio files attached to memo
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

    // Get memo files
    const files = await fileService.getFilesByMemoId(id);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files attached to this memo" },
        { status: 400 },
      );
    }

    // Filter audio files only
    const audioFiles = files.filter((file) =>
      file.mimeType.startsWith("audio/"),
    );

    if (audioFiles.length === 0) {
      return NextResponse.json(
        { error: "No audio files found" },
        { status: 400 },
      );
    }

    // Queue transcription jobs for all audio files
    const jobs = [];
    for (const file of audioFiles) {
      const job = await addFileProcessJob({
        fileId: file.id,
        s3Key: file.s3Key,
        mimeType: file.mimeType,
        operation: "transcribe",
        memoId: id, // Pass memo ID to worker
      });
      jobs.push({ fileId: file.id, jobId: job.id, filename: file.filename });
    }

    return NextResponse.json({
      success: true,
      message: `Queued ${jobs.length} transcription job(s)`,
      jobs,
    });
  } catch (error) {
    console.error("Transcription queue error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
