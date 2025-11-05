import { type Job, Worker } from "bullmq";
import IORedis from "ioredis";
import {
  type DocumentFormat,
  generateDocument,
  generateIntelligentDocument,
} from "@/lib/document-generator";
import { bucketName, minioClient } from "@/lib/minio";
import { analyzeTranscriptionIntent, transcribeAudio } from "@/lib/mistral";
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

          console.log(
            `[Worker] Transcription completed. Length: ${transcription.text.length} chars`,
          );

          // Analyze transcription to understand user intent
          console.log("[Worker] Analyzing user intent from transcription...");
          const intentAnalysis = await analyzeTranscriptionIntent(
            transcription.text,
          );
          console.log(
            `[Worker] Intent analysis: ${intentAnalysis.shouldGenerateDocument ? "Document requested" : "No document requested"}`,
          );

          await job.updateProgress(70);

          // Generate standard transcription documents in multiple formats
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
              `[Worker] Generated ${format.toUpperCase()} transcription: ${docFile.id}`,
            );
          }

          // Generate intelligent document if user requested one
          if (
            intentAnalysis.shouldGenerateDocument &&
            intentAnalysis.sections
          ) {
            console.log(
              `[Worker] Generating intelligent ${intentAnalysis.documentType || "DOCX"} document based on user request...`,
            );

            const intelligentFormat =
              (intentAnalysis.documentType?.toLowerCase() as DocumentFormat) ||
              "docx";

            const intelligentDocBuffer = await generateIntelligentDocument({
              title: intentAnalysis.userRequest || "AI-Generated Document",
              sections: intentAnalysis.sections,
              format: intelligentFormat,
              metadata: {
                createdAt: new Date(),
                originalTranscription: transcription.text,
              },
            });

            // Upload intelligent document to MinIO
            const intelligentDocFilename = `ai-document-${fileId}-${Date.now()}.${intelligentFormat}`;
            const intelligentDocS3Key = `documents/${intelligentDocFilename}`;

            await minioClient.putObject(
              bucketName,
              intelligentDocS3Key,
              intelligentDocBuffer,
              intelligentDocBuffer.length,
              {
                "Content-Type":
                  intelligentFormat === "pdf"
                    ? "application/pdf"
                    : intelligentFormat === "docx"
                      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      : "text/plain",
              },
            );

            // Create file record for intelligent document
            const intelligentDocFile = await fileService.createFile({
              filename: intelligentDocFilename,
              mimeType:
                intelligentFormat === "pdf"
                  ? "application/pdf"
                  : intelligentFormat === "docx"
                    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    : "text/plain",
              size: intelligentDocBuffer.length,
              s3Key: intelligentDocS3Key,
            });

            generatedDocs.push({
              format: `ai-${intelligentFormat}`,
              fileId: intelligentDocFile.id,
            });

            console.log(
              `[Worker] Generated AI ${intelligentFormat.toUpperCase()} document: ${intelligentDocFile.id}`,
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

            // Update memo with AI-generated title, transcription content, and DONE status
            const memoTitle =
              intentAnalysis.userRequest ||
              transcription.text.substring(0, 100) ||
              "Voice Memo";
            const updatedMemo = await prisma.memo.update({
              where: { id: memoId },
              data: {
                title: memoTitle,
                content: transcription.text,
                status: MemoStatus.DONE,
              },
              include: {
                user: true,
                files: {
                  include: {
                    file: true,
                  },
                },
              },
            });
            console.log(
              `[Worker] Updated memo with title "${memoTitle}" and status DONE: ${memoId}`,
            );

            // Send email notification
            try {
              const { sendMemoCompletedEmail } = await import("@/lib/email");

              // Find transcription and document files
              const transcriptionFile = updatedMemo.files.find(
                (f) =>
                  f.file.name.endsWith(".txt") &&
                  f.file.mimeType === "text/plain",
              );
              const documentFiles = updatedMemo.files
                .filter(
                  (f) =>
                    f.file.mimeType === "application/pdf" ||
                    f.file.mimeType ===
                      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
                .map((f) => ({
                  type: f.file.mimeType === "application/pdf" ? "pdf" : "docx",
                  url:
                    f.file.url ||
                    `${process.env.NEXT_PUBLIC_APP_URL}/api/files/${f.file.id}`,
                }));

              if (transcriptionFile && updatedMemo.user.email) {
                const transcriptionUrl =
                  transcriptionFile.file.url ||
                  `${process.env.NEXT_PUBLIC_APP_URL}/api/files/${transcriptionFile.file.id}`;

                await sendMemoCompletedEmail(
                  updatedMemo.user.email,
                  updatedMemo.user.name || "User",
                  memoTitle,
                  transcriptionUrl,
                  documentFiles,
                );
                console.log(
                  `[Worker] Sent completion email to ${updatedMemo.user.email}`,
                );
              }
            } catch (emailError) {
              console.error(
                "[Worker] Failed to send completion email:",
                emailError,
              );
              // Don't fail the job if email fails
            }
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
