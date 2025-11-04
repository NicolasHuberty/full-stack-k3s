import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

// Redis connection
const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

// Queue names
export const QUEUE_NAMES = {
  FILE_UPLOAD: "file-upload",
  FILE_PROCESS: "file-process",
  FILE_DELETE: "file-delete",
} as const;

// Job types
export interface FileUploadJob {
  fileBuffer: string; // base64 encoded
  filename: string;
  mimeType: string;
  size: number;
  userId?: string;
  memoId?: string;
}

export interface FileProcessJob {
  fileId: string;
  s3Key: string;
  mimeType: string;
  operation: "transcribe" | "analyze" | "compress";
  memoId?: string;
  userId?: string;
}

export interface FileDeleteJob {
  fileId: string;
  s3Key: string;
}

// Create queues
export const fileUploadQueue = new Queue<FileUploadJob>(
  QUEUE_NAMES.FILE_UPLOAD,
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: 100, // Keep last 100 completed jobs
      removeOnFail: 500, // Keep last 500 failed jobs
    },
  },
);

export const fileProcessQueue = new Queue<FileProcessJob>(
  QUEUE_NAMES.FILE_PROCESS,
  {
    connection,
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
    },
  },
);

export const fileDeleteQueue = new Queue<FileDeleteJob>(
  QUEUE_NAMES.FILE_DELETE,
  {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "fixed",
        delay: 1000,
      },
    },
  },
);

// Queue events (for monitoring)
export const fileUploadEvents = new QueueEvents(QUEUE_NAMES.FILE_UPLOAD, {
  connection,
});
export const fileProcessEvents = new QueueEvents(QUEUE_NAMES.FILE_PROCESS, {
  connection,
});
export const fileDeleteEvents = new QueueEvents(QUEUE_NAMES.FILE_DELETE, {
  connection,
});

// Helper to add file upload job
export async function addFileUploadJob(data: FileUploadJob) {
  const job = await fileUploadQueue.add("upload-file", data, {
    priority: data.memoId ? 1 : 5, // Higher priority if attached to memo
  });
  return job;
}

// Helper to add file process job
export async function addFileProcessJob(data: FileProcessJob) {
  const job = await fileProcessQueue.add(`process-${data.operation}`, data);
  return job;
}

// Helper to add file delete job
export async function addFileDeleteJob(data: FileDeleteJob) {
  const job = await fileDeleteQueue.add("delete-file", data);
  return job;
}

// Graceful shutdown
export async function closeQueues() {
  await fileUploadQueue.close();
  await fileProcessQueue.close();
  await fileDeleteQueue.close();
  await connection.quit();
}

// Health check
export async function checkQueueHealth() {
  try {
    await connection.ping();
    const uploadCounts = await fileUploadQueue.getJobCounts();
    const processCounts = await fileProcessQueue.getJobCounts();
    const deleteCounts = await fileDeleteQueue.getJobCounts();

    return {
      redis: "connected",
      queues: {
        fileUpload: uploadCounts,
        fileProcess: processCounts,
        fileDelete: deleteCounts,
      },
    };
  } catch (error) {
    return {
      redis: "disconnected",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
