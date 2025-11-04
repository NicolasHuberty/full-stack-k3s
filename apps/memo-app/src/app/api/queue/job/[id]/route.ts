import { type NextRequest, NextResponse } from "next/server";
import { fileUploadQueue } from "@/lib/queue";

// GET /api/queue/job/[id] - Get job status
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const job = await fileUploadQueue.getJob(id);

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const state = await job.getState();
    const progress = job.progress;
    const returnvalue = job.returnvalue;

    return NextResponse.json({
      jobId: job.id,
      name: job.name,
      state,
      progress,
      data: job.data,
      result: returnvalue,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
    });
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
