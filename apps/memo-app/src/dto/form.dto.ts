import { FormVisibility } from "@/generated/prisma";
import { z } from "zod";

export const createFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  teamId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
  visibility: z.nativeEnum(FormVisibility).optional(),
  category: z.string().optional(),
});

export const updateFormSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  visibility: z.nativeEnum(FormVisibility).optional(),
  isPublic: z.boolean().optional(),
});

export const publishFormSchema = z.object({
  visibility: z.nativeEnum(FormVisibility),
  category: z.string().optional(),
});

export type CreateFormDto = z.infer<typeof createFormSchema>;
export type UpdateFormDto = z.infer<typeof updateFormSchema>;
export type PublishFormDto = z.infer<typeof publishFormSchema>;
