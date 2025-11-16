import type {
  AttachFilesInput,
  CreateMemoInput,
  MemoFilters,
  UpdateMemoInput,
  UpdateMemoStatusInput,
} from "@/dto";
import { MemoStatus } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import type { Memo, MemoWithFiles } from "@/types";

export class MemoService {
  /**
   * Create a new memo
   */
  async createMemo(data: CreateMemoInput & { userId: string }): Promise<Memo> {
    const memo = await prisma.memo.create({
      data: {
        title: data.title,
        content: data.content,
        userId: data.userId,
        formId: data.formId,
        status: MemoStatus.DRAFT,
      },
    });

    return memo;
  }

  /**
   * Get memo by ID with optional file relations
   */
  async getMemoById(
    id: string,
    includeFiles = false,
  ): Promise<Memo | MemoWithFiles | null> {
    const memo = await prisma.memo.findUnique({
      where: { id },
      include: {
        memoFiles: includeFiles
          ? {
              include: {
                file: true,
              },
            }
          : undefined,
        formData: {
          include: {
            form: {
              include: {
                fields: {
                  include: {
                    options: true,
                  },
                  orderBy: {
                    order: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!memo) return null;

    if (includeFiles && memo.memoFiles) {
      const memoWithFiles = memo as any;
      return {
        ...memo,
        files: memoWithFiles.memoFiles.map((mf: any) => mf.file),
      } as MemoWithFiles;
    }

    return memo;
  }

  /**
   * Get all memos with filters
   */
  async getMemos(filters: MemoFilters): Promise<Memo[]> {
    const where: any = {};

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: "insensitive" } },
        { content: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const memos = await prisma.memo.findMany({
      where,
      take: filters.limit,
      skip: filters.offset,
      orderBy: { createdAt: "desc" },
    });

    return memos;
  }

  /**
   * Update memo
   */
  async updateMemo(id: string, data: UpdateMemoInput): Promise<Memo> {
    const memo = await prisma.memo.update({
      where: { id },
      data,
    });

    // If status changed to RUNNING, trigger transcription
    if (data.status === MemoStatus.RUNNING) {
      // Import queue functions dynamically to avoid circular dependencies
      const { triggerMemoTranscription } = await import(
        "./transcription.service"
      );
      await triggerMemoTranscription(id).catch((error) => {
        console.error(`Failed to trigger transcription for memo ${id}:`, error);
        // Don't throw - we still want to update the status even if transcription fails
      });
    }

    return memo;
  }

  /**
   * Update memo status with business logic validation
   */
  async updateMemoStatus(
    id: string,
    data: UpdateMemoStatusInput,
  ): Promise<Memo> {
    const memo = await this.getMemoById(id);
    if (!memo) {
      throw new Error("Memo not found");
    }

    // Business rule: Cannot transition from RUNNING to DRAFT
    if (
      memo.status === MemoStatus.RUNNING &&
      data.status === MemoStatus.DRAFT
    ) {
      throw new Error("Cannot change running memo back to draft");
    }

    // Business rule: ARCHIVED memos cannot be changed
    if (memo.status === MemoStatus.ARCHIVED) {
      throw new Error("Cannot change archived memo status");
    }

    return await this.updateMemo(id, { status: data.status });
  }

  /**
   * Attach files to a memo
   */
  async attachFiles(memoId: string, data: AttachFilesInput): Promise<void> {
    const memo = await this.getMemoById(memoId);
    if (!memo) {
      throw new Error("Memo not found");
    }

    // Verify all files exist
    const files = await prisma.file.findMany({
      where: { id: { in: data.fileIds } },
    });

    if (files.length !== data.fileIds.length) {
      throw new Error("One or more files not found");
    }

    // Create associations
    await prisma.memoFile.createMany({
      data: data.fileIds.map((fileId) => ({
        memoId,
        userId: memo.userId,
        fileId,
      })),
      skipDuplicates: true,
    });
  }

  /**
   * Delete memo (soft delete by archiving)
   */
  async deleteMemo(id: string): Promise<void> {
    const memo = await this.getMemoById(id);
    if (!memo) {
      throw new Error("Memo not found");
    }

    // Business rule: Cannot delete running memos
    if (memo.status === MemoStatus.RUNNING) {
      throw new Error("Cannot delete a running memo");
    }

    await this.updateMemo(id, { status: MemoStatus.ARCHIVED });
  }

  /**
   * Hard delete memo (use with caution)
   */
  async hardDeleteMemo(id: string): Promise<void> {
    // Delete associated memoFiles first
    await prisma.memoFile.deleteMany({
      where: { memoId: id },
    });

    await prisma.memo.delete({
      where: { id },
    });
  }

  /**
   * Get memo count by user
   */
  async getMemoCountByUser(userId: string): Promise<number> {
    return await prisma.memo.count({
      where: { userId },
    });
  }

  /**
   * Get memo count by status
   */
  async getMemoCountByStatus(
    userId: string,
    status: MemoStatus,
  ): Promise<number> {
    return await prisma.memo.count({
      where: { userId, status },
    });
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    return await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
      },
    });
  }
}

export const memoService = new MemoService();
