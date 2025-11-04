import { NextRequest, NextResponse } from "next/server";
import { fileService } from "@/services";
import { addFileProcessJob } from "@/lib/queue";

export const runtime = "nodejs";

// POST /api/files/[id]/transcribe - Trigger audio transcription
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get file from database
    const file = await fileService.getFileById(id);

    if (!file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Check if file is audio
    if (!file.mimeType.startsWith("audio/")) {
      return NextResponse.json(
        { error: "File is not an audio file" },
        { status: 400 }
      );
    }

    // Add transcription job to queue
    const job = await addFileProcessJob({
      fileId: file.id,
      s3Key: file.s3Key,
      mimeType: file.mimeType,
      operation: "transcribe",
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: "Transcription job queued successfully",
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
