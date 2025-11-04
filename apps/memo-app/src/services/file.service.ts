import type { FileFilters, UploadFileInput } from "@/dto";
import { bucketName, minioClient } from "@/lib/minio";
import { prisma } from "@/lib/prisma";
import type { File, FileUploadResult } from "@/types";

export class FileService {
  /**
   * Create file record after upload to MinIO
   */
  async createFile(data: UploadFileInput & { s3Key: string }): Promise<File> {
    const file = await prisma.file.create({
      data: {
        filename: data.filename,
        mimeType: data.mimeType,
        size: data.size,
        s3Key: data.s3Key,
      },
    });

    return file;
  }

  /**
   * Get file by ID
   */
  async getFileById(id: string): Promise<File | null> {
    return await prisma.file.findUnique({
      where: { id },
    });
  }

  /**
   * Get files with filters
   */
  async getFiles(filters: FileFilters): Promise<File[]> {
    const where: any = {};

    if (filters.mimeType) {
      where.mimeType = filters.mimeType;
    }

    return await prisma.file.findMany({
      where,
      take: filters.limit,
      skip: filters.offset,
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Delete file from both MinIO and database
   */
  async deleteFile(id: string): Promise<void> {
    // Check if file is associated with any memos
    const associations = await prisma.memoFile.count({
      where: { fileId: id },
    });

    if (associations > 0) {
      throw new Error("Cannot delete file that is attached to memos");
    }

    const file = await this.getFileById(id);
    if (!file) {
      throw new Error("File not found");
    }

    // Delete from MinIO
    try {
      await minioClient.removeObject(bucketName, file.s3Key);
    } catch (error) {
      console.error("Error deleting from MinIO:", error);
      // Continue to delete from database even if MinIO deletion fails
    }

    await prisma.file.delete({
      where: { id },
    });
  }

  /**
   * Upload file to MinIO and create database record
   */
  async uploadFile(
    file: Buffer,
    metadata: UploadFileInput,
  ): Promise<FileUploadResult> {
    const s3Key = `uploads/${Date.now()}-${metadata.filename}`;

    // Upload to MinIO
    await minioClient.putObject(bucketName, s3Key, file, metadata.size, {
      "Content-Type": metadata.mimeType,
    });

    // Create database record
    const fileRecord = await this.createFile({
      ...metadata,
      s3Key,
    });

    return {
      fileId: fileRecord.id,
      filename: fileRecord.filename,
      size: fileRecord.size,
      url: `/api/files/${fileRecord.id}/download`,
    };
  }

  /**
   * Get file download URL (presigned URL from MinIO)
   */
  async getFileDownloadUrl(id: string): Promise<string> {
    const file = await this.getFileById(id);
    if (!file) {
      throw new Error("File not found");
    }

    // Generate presigned URL (valid for 1 hour)
    const url = await minioClient.presignedGetObject(
      bucketName,
      file.s3Key,
      3600,
    );
    return url;
  }

  /**
   * Get file stream from MinIO
   */
  async getFileStream(id: string): Promise<{ stream: any; file: File }> {
    const file = await this.getFileById(id);
    if (!file) {
      throw new Error("File not found");
    }

    const stream = await minioClient.getObject(bucketName, file.s3Key);
    return { stream, file };
  }

  /**
   * Get files by memo ID
   */
  async getFilesByMemoId(memoId: string): Promise<File[]> {
    const memoFiles = await prisma.memoFile.findMany({
      where: { memoId },
      include: { file: true },
    });

    return memoFiles.map((mf) => mf.file);
  }
}

export const fileService = new FileService();
