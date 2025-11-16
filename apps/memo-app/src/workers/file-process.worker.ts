import { type Job, Worker } from "bullmq";
import IORedis from "ioredis";
import {
  type DocumentFormat,
  generateDocument,
} from "@/lib/document-generator";
import { sendMemoCompletedEmail } from "@/lib/email";
import { bucketName, minioClient } from "@/lib/minio";
import { processTextWithAI, transcribeAudio } from "@/lib/mistral";
import { type FileProcessJob, QUEUE_NAMES } from "@/lib/queue";
import { fileService } from "@/services";

const connection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  {
    maxRetriesPerRequest: null,
  },
);

export const fileProcessWorker = new Worker<FileProcessJob>(
  QUEUE_NAMES.FILE_PROCESS,
  async (job: Job<FileProcessJob>) => {
    const { fileId, s3Key, operation, memoId } = job.data;

    console.log(`[Worker] Processing file: ${fileId}, operation: ${operation}`);

    try {
      await job.updateProgress(10);

      switch (operation) {
        case "transcribe": {
          let transcriptionText = "";
          let isTextMemo = !fileId || fileId === "";

          // Update memo status to RUNNING if memoId provided
          if (memoId) {
            const { prisma } = await import("@/lib/prisma");
            const { MemoStatus } = await import("@/generated/prisma");
            await prisma.memo.update({
              where: { id: memoId },
              data: { status: MemoStatus.RUNNING },
            });
            console.log(`[Worker] Updated memo status to RUNNING: ${memoId}`);
          }

          if (isTextMemo) {
            // Text memo - get content from database
            console.log(`[Worker] Processing text memo: ${memoId}`);
            const { prisma } = await import("@/lib/prisma");
            const memo = await prisma.memo.findUnique({
              where: { id: memoId },
              select: { content: true },
            });

            if (!memo || !memo.content) {
              throw new Error("Memo not found or has no content");
            }

            transcriptionText = memo.content;
            await job.updateProgress(30);
          } else {
            // Audio memo - transcribe
            console.log(`[Worker] Transcribing audio file: ${s3Key}`);

            if (!fileId) {
              throw new Error("No file ID provided for audio transcription");
            }

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

            await job.updateProgress(20);

            // Transcribe with Mistral Voxtral
            const transcription = await transcribeAudio(audioBuffer, {
              filename: fileInfo.filename,
            });

            transcriptionText = transcription.text;
            await job.updateProgress(40);
          }

          console.log(
            `[Worker] ${isTextMemo ? "Text processing" : "Transcription"} completed. Length: ${transcriptionText.length} chars`,
          );

          // Process with AI to structure/improve content
          const processedContent = await processTextWithAI(transcriptionText, {
            task: "structure",
          });

          await job.updateProgress(60);

          console.log(
            `[Worker] AI processing completed. Generated ${processedContent.length} chars`,
          );

          // Generate documents in multiple formats with AI-processed content
          const formats: DocumentFormat[] = ["txt", "pdf", "docx"];
          const generatedDocs: Array<{ format: string; fileId: string }> = [];

          // Extract title from processed content (first line or first # heading)
          const titleMatch =
            processedContent.match(/^#\s+(.+)$/m) ||
            processedContent.match(/^(.+)$/m);
          const documentTitle = titleMatch
            ? titleMatch[1].trim()
            : `Document - ${new Date().toLocaleDateString("fr-FR")}`;

          for (const format of formats) {
            const docBuffer = await generateDocument({
              title: documentTitle,
              transcription: {
                text: processedContent, // Use AI-processed content
                language: "fr",
              },
              format,
              includeTimestamps: false, // No timestamps for text memos
              metadata: {
                createdAt: new Date(),
              },
            });

            // Upload document to MinIO
            const docFilename = `document-${memoId || Date.now()}-${Date.now()}.${format}`;
            const docS3Key = `documents/${docFilename}`;

            await minioClient.putObject(
              bucketName,
              docS3Key,
              docBuffer,
              docBuffer.length,
              {
                "Content-Type":
                  format === "pdf"
                    ? "application/pdf"
                    : format === "docx"
                      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      : "text/plain",
              },
            );

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

            console.log(
              `[Worker] Generated ${format.toUpperCase()} document: ${docFile.id}`,
            );
          }

          // Attach generated documents to the memo if memoId provided
          if (memoId) {
            const { memoService } = await import("@/services");
            const { prisma } = await import("@/lib/prisma");
            const { MemoStatus } = await import("@/generated/prisma");

            const docFileIds = generatedDocs.map((doc) => doc.fileId);
            await memoService.attachFiles(memoId, { fileIds: docFileIds });
            console.log(
              `[Worker] Attached ${docFileIds.length} document(s) to memo: ${memoId}`,
            );

            // Update memo with AI-processed content, title, and status
            const updatedMemo = await prisma.memo.update({
              where: { id: memoId },
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    emailVerified: true,
                  },
                },
              },
              data: {
                content: processedContent, // Use AI-processed content
                title: documentTitle,
                status: MemoStatus.DONE,
              },
            });
            console.log(
              `[Worker] Updated memo with AI-processed content and status DONE: ${memoId}`,
            );

            // Send email notification to user
            if (updatedMemo.user?.email && updatedMemo.user.emailVerified) {
              try {
                await sendMemoCompletedEmail(
                  updatedMemo.user.email,
                  updatedMemo.title,
                  updatedMemo.content,
                  updatedMemo.id,
                  generatedDocs.map((doc) => ({
                    filename: `document.${doc.format}`,
                    path: doc.fileId,
                  })),
                );
                console.log(
                  `[Worker] Sent completion email to ${updatedMemo.user.email}`,
                );
              } catch (emailError) {
                console.error(
                  "[Worker] Failed to send email notification:",
                  emailError,
                );
                // Don't fail the job if email fails
              }
            }
          }

          await job.updateProgress(100);

          return {
            success: true,
            transcription: transcriptionText,
            language: isTextMemo ? "fr" : undefined,
            duration: undefined,
            segmentCount: 0,
            documents: generatedDocs,
          };
        }

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
  },
);

fileProcessWorker.on("completed", (job) => {
  console.log(`[Worker] Processing job ${job.id} completed`);
});

fileProcessWorker.on("failed", (job, err) => {
  console.error(`[Worker] Processing job ${job?.id} failed:`, err.message);
});

console.log(
  `[Worker] File process worker started, processing queue: ${QUEUE_NAMES.FILE_PROCESS}`,
);
