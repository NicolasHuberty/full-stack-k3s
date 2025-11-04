import { Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { QUEUE_NAMES, type FileProcessJob } from "@/lib/queue";
import { transcribeAudio } from "@/lib/mistral";
import { generateDocument, type DocumentFormat } from "@/lib/document-generator";
import { minioClient, bucketName } from "@/lib/minio";
import { fileService } from "@/services";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const fileProcessWorker = new Worker<FileProcessJob>(
  QUEUE_NAMES.FILE_PROCESS,
  async (job: Job<FileProcessJob>) => {
    const { fileId, s3Key, mimeType, operation, memoId, userId } = job.data;

    console.log(`[Worker] Processing file: ${fileId}, operation: ${operation}`);

    try {
      await job.updateProgress(10);

      switch (operation) {
        case "transcribe":
          console.log(`[Worker] Transcribing audio file: ${s3Key}`);

          // Get file info
          const fileInfo = await fileService.getFileById(fileId);
          if (!fileInfo) {
            throw new Error(`File not found: ${fileId}`);
          }

          // Download audio from MinIO
          const audioStream = await minioClient.getObject(bucketName, s3Key);
          const chunks: Buffer[] = [];
          for await (const chunk of audioStream) {
            chunks.push(chunk);
          }
          const audioBuffer = Buffer.concat(chunks);

          await job.updateProgress(30);

          // Transcribe with Mistral Voxtral
          const transcription = await transcribeAudio(audioBuffer, {
            filename: fileInfo.filename,
            timestampGranularities: "segment",
          });

          await job.updateProgress(60);

          console.log(`[Worker] Transcription completed. Length: ${transcription.text.length} chars`);

          // Generate documents in multiple formats
          const formats: DocumentFormat[] = ["txt", "pdf", "docx"];
          const generatedDocs: Array<{ format: string; fileId: string }> = [];

          for (const format of formats) {
            const docBuffer = await generateDocument({
              title: `Transcription - ${new Date().toLocaleDateString()}`,
              transcription,
              format,
              includeTimestamps: true,
              metadata: {
                createdAt: new Date(),
                duration: transcription.duration,
              },
            });

            // Upload document to MinIO
            const docFilename = `transcription-${fileId}-${Date.now()}.${format}`;
            const docS3Key = `transcriptions/${docFilename}`;

            await minioClient.putObject(bucketName, docS3Key, docBuffer, docBuffer.length, {
              "Content-Type":
                format === "pdf"
                  ? "application/pdf"
                  : format === "docx"
                  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  : "text/plain",
            });

            // Create file record in database
            const docFile = await fileService.createFile({
              filename: docFilename,
              mimeType:
                format === "pdf"
                  ? "application/pdf"
                  : format === "docx"
                  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  : "text/plain",
              size: docBuffer.length,
              s3Key: docS3Key,
            });

            generatedDocs.push({ format, fileId: docFile.id });

            console.log(`[Worker] Generated ${format.toUpperCase()} document: ${docFile.id}`);
          }

          // Attach generated documents to the memo if memoId provided
          if (memoId) {
            const { memoService } = await import("@/services");
            const { prisma } = await import("@/lib/prisma");
            const { MemoStatus } = await import("@/generated/prisma");

            const docFileIds = generatedDocs.map(doc => doc.fileId);
            await memoService.attachFiles(memoId, { fileIds: docFileIds });
            console.log(`[Worker] Attached ${docFileIds.length} document(s) to memo: ${memoId}`);

            // Update memo status to DONE after successful transcription (direct update to avoid hooks)
            await prisma.memo.update({
              where: { id: memoId },
              data: { status: MemoStatus.DONE },
            });
            console.log(`[Worker] Updated memo status to DONE: ${memoId}`);
          }

          await job.updateProgress(100);

          return {
            success: true,
            transcription: transcription.text,
            language: transcription.language,
            duration: transcription.duration,
            segmentCount: transcription.segments?.length || 0,
            documents: generatedDocs,
          };

        case "analyze":
          console.log(`[Worker] Analyzing file: ${s3Key}`);
          await job.updateProgress(100);
          return { success: true, analysis: { duration: 0, quality: "good" } };

        case "compress":
          console.log(`[Worker] Compressing file: ${s3Key}`);
          await job.updateProgress(100);
          return { success: true, compressed: true };

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error) {
      console.error(`[Worker] File processing failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: 2, // Process 2 transcriptions simultaneously (API limits)
  }
);

fileProcessWorker.on("completed", (job) => {
  console.log(`[Worker] Processing job ${job.id} completed`);
});

fileProcessWorker.on("failed", (job, err) => {
  console.error(`[Worker] Processing job ${job?.id} failed:`, err.message);
});

console.log(`[Worker] File process worker started, processing queue: ${QUEUE_NAMES.FILE_PROCESS}`);
