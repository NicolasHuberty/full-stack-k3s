import { z } from "zod";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (larger for audio files)
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "application/json",
  // Audio formats
  "audio/webm",
  "audio/wav",
  "audio/mp3",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
];

export const uploadFileSchema = z.object({
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().refine((type) => ALLOWED_MIME_TYPES.includes(type), {
    message: "File type not allowed",
  }),
  size: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE, "File size exceeds 50MB limit"),
});

export const fileFiltersSchema = z.object({
  mimeType: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type FileFilters = z.infer<typeof fileFiltersSchema>;
