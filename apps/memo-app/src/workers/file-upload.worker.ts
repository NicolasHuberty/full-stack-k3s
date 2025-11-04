import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { fileService } from "@/services";
import { memoService } from "@/services";
import { QUEUE_NAMES, type FileUploadJob } from "@/lib/queue";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const fileUploadWorker = new Worker<FileUploadJob>(
  QUEUE_NAMES.FILE_UPLOAD,
  async (job: Job<FileUploadJob>) => {
    const { fileBuffer, filename, mimeType, size, userId, memoId } = job.data;

    console.log(`[Worker] Processing file upload: ${filename} (Job ${job.id})`);

    try {
      // Update job progress
      await job.updateProgress(10);

      // Decode base64 buffer
      const buffer = Buffer.from(fileBuffer, "base64");

      await job.updateProgress(30);

      // Upload to MinIO and create DB record
      const result = await fileService.uploadFile(buffer, {
        filename,
        mimeType,
        size,
      });

      await job.updateProgress(70);

      // If memoId is provided, attach the file to the memo
      if (memoId && result.fileId) {
        await memoService.attachFiles(memoId, {
          fileIds: [result.fileId],
        });
        console.log(`[Worker] File ${result.fileId} attached to memo ${memoId}`);
      }

      await job.updateProgress(100);

      console.log(`[Worker] File upload completed: ${result.fileId}`);

      return {
        success: true,
        fileId: result.fileId,
        filename: result.filename,
        url: result.url,
      };
    } catch (error) {
      console.error(`[Worker] File upload failed:`, error);
      throw error; // Will trigger retry
    }
  },
  {
    connection,
    concurrency: 5, // Process 5 uploads simultaneously
    limiter: {
      max: 10, // Max 10 jobs
      duration: 1000, // per second
    },
  }
);

// Event handlers
fileUploadWorker.on("completed", (job) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

fileUploadWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err.message);
});

fileUploadWorker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] SIGTERM received, closing worker...");
  await fileUploadWorker.close();
  await connection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Worker] SIGINT received, closing worker...");
  await fileUploadWorker.close();
  await connection.quit();
  process.exit(0);
});

console.log(`[Worker] File upload worker started, processing queue: ${QUEUE_NAMES.FILE_UPLOAD}`);
