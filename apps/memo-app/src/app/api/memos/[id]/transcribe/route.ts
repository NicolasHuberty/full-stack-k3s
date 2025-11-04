import { NextRequest, NextResponse } from "next/server";
import { fileService, memoService } from "@/services";
import { addFileProcessJob } from "@/lib/queue";

export const runtime = "nodejs";

// POST /api/memos/[id]/transcribe - Transcribe all audio files attached to memo
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get memo files
    const files = await fileService.getFilesByMemoId(id);

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files attached to this memo" },
        { status: 400 }
      );
    }

    // Filter audio files only
    const audioFiles = files.filter((file) => file.mimeType.startsWith("audio/"));

    if (audioFiles.length === 0) {
      return NextResponse.json(
        { error: "No audio files found" },
        { status: 400 }
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
