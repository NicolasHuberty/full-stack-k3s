/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'
import { getMinIOClient } from '@/lib/storage/minio'
import { getQdrantClient } from '@/lib/vector/qdrant'
import { getTextExtractor } from '@/lib/processing/extract'
import { getChunkingService } from '@/lib/processing/chunking'
import { getEmbeddingService } from '@/lib/processing/embeddings'
import { sendDocumentProcessingJob } from '@/lib/queue/pgboss'
import { randomBytes } from 'crypto'
import { logger } from '@/lib/logger'

export interface ProcessDocumentInput {
  collectionId: string
  file: Buffer
  filename: string
  mimeType: string
  uploadedById: string
}

export interface UploadResult {
  document: any
  success: boolean
  message: string
}

/**
 * Main document processing pipeline
 * 1. Upload file to MinIO
 * 2. Create document record
 * 3. Extract text
 * 4. Chunk text
 * 5. Generate embeddings
 * 6. Store in Qdrant
 * 7. Update document status
 */
export class DocumentProcessor {
  /**
   * Upload and queue document for processing
   */
  async uploadDocument(input: ProcessDocumentInput): Promise<UploadResult> {
    try {
      // Get collection settings
      const collection = await prisma.collection.findUnique({
        where: { id: input.collectionId },
      })

      if (!collection) {
        throw new Error('Collection not found')
      }

      // Generate unique filename
      const fileExtension = input.filename.split('.').pop()
      const uniqueFilename = `${input.collectionId}/${randomBytes(16).toString('hex')}.${fileExtension}`

      // Upload to MinIO
      const minio = getMinIOClient()
      const fileUrl = await minio.uploadFile(
        uniqueFilename,
        input.file,
        input.mimeType
      )

      // Create document record and update collection stats immediately
      const document = await prisma.document.create({
        data: {
          collectionId: input.collectionId,
          filename: uniqueFilename,
          originalName: input.filename,
          mimeType: input.mimeType,
          fileSize: BigInt(input.file.length),
          fileUrl,
          status: 'PENDING',
          uploadedById: input.uploadedById,
        },
        include: {
          collection: true,
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // Update collection stats immediately on upload
      await prisma.collection.update({
        where: { id: input.collectionId },
        data: {
          documentCount: { increment: 1 },
          storageUsed: { increment: BigInt(input.file.length) },
        },
      })

      // Determine priority based on document type (scanned PDFs get lower priority)
      const isScannedPDF = input.mimeType === 'application/pdf' // Will be determined by worker
      const priority = isScannedPDF ? -1 : 0 // Higher number = higher priority

      // Send job to pg-boss queue
      const jobId = await sendDocumentProcessingJob({
        documentId: document.id,
        collectionId: input.collectionId,
        userId: input.uploadedById,
        priority,
      })

      // Create processing job record
      await prisma.processingJob.create({
        data: {
          documentId: document.id,
          status: 'QUEUED',
          priority,
          pgBossJobId: jobId,
        },
      })

      logger.info('Document uploaded and queued for processing', {
        documentId: document.id,
        jobId,
        priority,
      })

      return {
        document,
        success: true,
        message: 'Document uploaded and queued for processing',
      }
    } catch (error) {
      console.error('Failed to upload document:', error)
      throw error
    }
  }

  /**
   * Process a document through the complete pipeline
   */
  async processDocument(documentId: string): Promise<void> {
    try {
      // Update job status
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      })

      // Update document status
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'PROCESSING' },
      })

      // Get document with collection
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { collection: true },
      })

      if (!document) {
        throw new Error('Document not found')
      }

      // Step 1: Download file from MinIO
      const minio = getMinIOClient()
      const fileBuffer = await minio.downloadFile(document.filename)

      // Step 2: Extract text
      const extractor = getTextExtractor()
      const { text, metadata } = await extractor.extractText(
        fileBuffer,
        document.mimeType
      )
      const cleanedText = extractor.cleanText(text)

      // Check if text extraction failed
      if (!cleanedText || cleanedText.trim().length === 0) {
        throw new Error(
          'Failed to extract text from document. The document may be empty, image-based (scanned), corrupted, or in an unsupported format. For scanned PDFs, please ensure the document has a text layer or use OCR.'
        )
      }

      // Warn if very little text extracted
      if (cleanedText.length < 100) {
        console.warn(
          `Very little text extracted (${cleanedText.length} chars). Document may be image-based or have extraction issues.`
        )
      }

      // Update document with extracted text
      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractedText: cleanedText,
          pageCount: metadata?.pageCount,
          wordCount: metadata?.wordCount,
          title: metadata?.title || document.originalName,
          author: metadata?.author,
        },
      })

      // Step 3: Chunk text
      const chunker = getChunkingService()
      const chunks = chunker.chunkText(cleanedText, {
        chunkSize: document.collection.chunkSize,
        chunkOverlap: document.collection.chunkOverlap,
        respectSentences: true,
      })
      // Add token counts to chunks
      const chunksWithTokens = await chunker.addTokenCounts(chunks)

      // Step 4: Generate embeddings
      const embeddingService = getEmbeddingService()
      const chunkTexts = chunksWithTokens.map((c) => c.content)
      const { embeddings } = await embeddingService.generateBatchEmbeddings(
        chunkTexts,
        document.collection.embeddingModel as any
      )

      // Step 5: Store chunks in database
      const documentChunks = await Promise.all(
        chunksWithTokens.map((chunk, _index) =>
          prisma.documentChunk.create({
            data: {
              documentId: document.id,
              chunkIndex: chunk.index,
              content: chunk.content,
              startChar: chunk.startChar,
              endChar: chunk.endChar,
              tokenCount: chunk.tokenCount,
            },
          })
        )
      )

      // Step 6: Store vectors in Qdrant
      const qdrant = getQdrantClient()
      const vectorData = documentChunks.map((chunk, index) => ({
        id: chunk.id,
        vector: embeddings[index],
        payload: {
          documentId: document.id,
          collectionId: document.collectionId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          documentName: document.originalName,
          metadata: {
            startPage: chunk.startPage,
            endPage: chunk.endPage,
            pageNumber: chunk.startPage || chunk.endPage || 1, // Use startPage as primary page number
          },
        },
      }))

      await qdrant.upsertChunks(
        document.collectionId,
        vectorData,
        document.collection.embeddingModel as any
      )

      // Update chunks with vector IDs
      await Promise.all(
        documentChunks.map((chunk) =>
          prisma.documentChunk.update({
            where: { id: chunk.id },
            data: { vectorId: chunk.id },
          })
        )
      )

      // Step 7: Update document status
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'COMPLETED',
          embeddingModel: document.collection.embeddingModel,
          totalChunks: chunks.length,
          processedAt: new Date(),
        },
      })

      // Collection stats were already updated on upload, no need to update again

      // Update job status
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })
    } catch (error) {
      console.error(`Failed to process document ${documentId}:`, error)

      // Update document status to failed
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          processingError:
            error instanceof Error ? error.message : 'Unknown error',
        },
      })

      // Update job status
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
          attempts: { increment: 1 },
        },
      })

      throw error
    }
  }

  /**
   * Delete a document and its associated data
   */
  async deleteDocument(documentId: string, _userId: string): Promise<void> {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: { collection: true },
      })

      if (!document) {
        throw new Error('Document not found')
      }

      // Delete from MinIO
      try {
        const minio = getMinIOClient()
        await minio.deleteFile(document.filename)
      } catch (error) {
        console.error('Failed to delete file from MinIO:', error)
      }

      // Delete from Qdrant
      try {
        const qdrant = getQdrantClient()
        await qdrant.deleteDocumentChunks(document.collectionId, documentId)
      } catch (error) {
        console.error('Failed to delete chunks from Qdrant:', error)
      }

      // Delete from database (cascades to chunks)
      await prisma.document.delete({
        where: { id: documentId },
      })

      // Update collection stats
      await prisma.collection.update({
        where: { id: document.collectionId },
        data: {
          documentCount: { decrement: 1 },
          storageUsed: { decrement: document.fileSize },
        },
      })

    } catch (error) {
      console.error('Failed to delete document:', error)
      throw error
    }
  }

  /**
   * Retry a failed document processing job
   */
  async retryProcessing(documentId: string): Promise<void> {
    try {
      const job = await prisma.processingJob.findUnique({
        where: { documentId },
        include: { document: true },
      })

      if (!job) {
        throw new Error('Processing job not found')
      }

      if (job.attempts >= job.maxAttempts) {
        throw new Error('Maximum retry attempts reached')
      }

      // Send new job to pg-boss queue
      const newJobId = await sendDocumentProcessingJob({
        documentId,
        collectionId: job.document.collectionId,
        userId: job.document.uploadedById,
        priority: job.priority,
      })

      // Reset job status
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          status: 'QUEUED',
          error: null,
          pgBossJobId: newJobId,
          retryAfter: null,
          failedAt: null,
        },
      })

      // Reset document status
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'PENDING',
          processingError: null,
        },
      })

      logger.info('Document processing retry queued', {
        documentId,
        jobId: newJobId,
      })
    } catch (error) {
      logger.error('Failed to retry processing', error)
      throw error
    }
  }

  /**
   * Get document processing status
   */
  async getProcessingStatus(documentId: string) {
    try {
      const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
          processingJob: true,
          _count: {
            select: {
              chunks: true,
            },
          },
        },
      })

      if (!document) {
        throw new Error('Document not found')
      }

      return {
        documentId: document.id,
        status: document.status,
        error: document.processingError,
        totalChunks: document.totalChunks,
        processedChunks: document._count.chunks,
        job: document.processingJob,
      }
    } catch (error) {
      console.error('Failed to get processing status:', error)
      throw error
    }
  }
}

// Singleton instance
let documentProcessor: DocumentProcessor | null = null

export function getDocumentProcessor(): DocumentProcessor {
  if (!documentProcessor) {
    documentProcessor = new DocumentProcessor()
  }
  return documentProcessor
}
