import { z } from "zod";
import { MemoStatus } from "@/generated/prisma";

export const createMemoSchema = z.object({
  title: z.string().min(1, "Title is required").max(255, "Title too long"),
  content: z.string().min(1, "Content is required"),
  userId: z.string().uuid("Invalid user ID").optional(),
  formId: z.string().uuid().optional(),
});

export const updateMemoSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  status: z.nativeEnum(MemoStatus).optional(),
});

export const updateMemoStatusSchema = z.object({
  status: z.nativeEnum(MemoStatus),
});

export const memoFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  status: z.nativeEnum(MemoStatus).optional(),
  search: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20),
  offset: z.number().int().nonnegative().default(0),
});

export const attachFilesSchema = z.object({
  fileIds: z.array(z.string().uuid()).min(1, "At least one file required"),
});

export type CreateMemoInput = z.infer<typeof createMemoSchema>;
export type UpdateMemoInput = z.infer<typeof updateMemoSchema>;
export type UpdateMemoStatusInput = z.infer<typeof updateMemoStatusSchema>;
export type MemoFilters = z.infer<typeof memoFiltersSchema>;
export type AttachFilesInput = z.infer<typeof attachFilesSchema>;
