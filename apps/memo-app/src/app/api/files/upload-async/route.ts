import { type NextRequest, NextResponse } from "next/server";
import { addFileUploadJob } from "@/lib/queue";

export const runtime = "nodejs";

// POST /api/files/upload-async - Upload file asynchronously via queue
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const memoId = formData.get("memoId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Convert File to Buffer and encode as base64
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileBuffer = buffer.toString("base64");

    // Add job to queue
    const job = await addFileUploadJob({
      fileBuffer,
      filename: file.name,
      mimeType: file.type,
      size: file.size,
      memoId: memoId || undefined,
    });

    return NextResponse.json(
      {
        success: true,
        jobId: job.id,
        message: "File upload queued successfully",
      },
      { status: 202 },
    ); // 202 Accepted
  } catch (error) {
    console.error("File upload queue error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
