import { addFileProcessJob } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { fileService } from "./file.service";

/**
 * Trigger transcription for all audio files in a memo
 */
export async function triggerMemoTranscription(memoId: string) {
  console.log(`[Transcription] Triggering transcription for memo: ${memoId}`);

  // Get the memo to retrieve userId
  const memo = await prisma.memo.findUnique({
    where: { id: memoId },
  });

  if (!memo) {
    console.error(`[Transcription] Memo not found: ${memoId}`);
    return { success: false, message: "Memo not found", jobs: [] };
  }

  // Get all files attached to memo
  const files = await fileService.getFilesByMemoId(memoId);

  if (files.length === 0) {
    console.log(`[Transcription] No files found for memo: ${memoId}`);
    return { success: false, message: "No files attached to memo", jobs: [] };
  }

  // Filter audio files only
  const audioFiles = files.filter((file) => file.mimeType.startsWith("audio/"));

  if (audioFiles.length === 0) {
    console.log(`[Transcription] No audio files found for memo: ${memoId}`);
    return { success: false, message: "No audio files found", jobs: [] };
  }

  console.log(
    `[Transcription] Found ${audioFiles.length} audio file(s) to transcribe`,
  );

  // Queue transcription jobs for all audio files
  const jobs = [];
  for (const file of audioFiles) {
    try {
      const job = await addFileProcessJob({
        fileId: file.id,
        s3Key: file.s3Key,
        mimeType: file.mimeType,
        operation: "transcribe",
        memoId: memoId,
        userId: memo.userId,
      });
      jobs.push({ fileId: file.id, jobId: job.id, filename: file.filename });
      console.log(
        `[Transcription] Queued job ${job.id} for file: ${file.filename}`,
      );
    } catch (error) {
      console.error(
        `[Transcription] Failed to queue job for file ${file.id}:`,
        error,
      );
    }
  }

  return {
    success: true,
    message: `Queued ${jobs.length} transcription job(s)`,
    jobs,
  };
}
