#!/usr/bin/env node
/**
 * Document Processing Worker
 *
 * This worker process subscribes to pg-boss job queue and processes documents
 * with proper retry logic, state tracking, and error handling.
 */

import { getPgBoss, DocumentProcessingJobData } from '../lib/queue/pgboss'
import { prisma } from '../lib/prisma'
import { getMinIOClient } from '../lib/storage/minio'
import { getQdrantClient } from '../lib/vector/qdrant'
import { getTextExtractor } from '../lib/processing/extract'
import { getChunkingService } from '../lib/processing/chunking'
import {
  getEmbeddingService,
  type EmbeddingModel,
} from '../lib/processing/embeddings'
import { logger } from '../lib/logger'
import { Prisma } from '@prisma/client'

interface ProcessingMetadata {
  textExtracted?: boolean
  chunksCreated?: boolean
  embeddingsGenerated?: boolean
  vectorsStored?: boolean
  lastError?: string
  [key: string]: unknown // Add index signature for Prisma compatibility
}

/**
 * Process a document job with state tracking for resumability
 */
async function processDocumentJob(job: {
  id: string
  data: DocumentProcessingJobData
}) {
  const { documentId, collectionId: _collectionId, userId: _userId } = job.data
  const workerId = process.pid.toString()

  logger.info('Processing document job', {
    jobId: job.id,
    documentId,
    workerId,
  })

  try {
    // Update job with worker ID
    await prisma.processingJob.update({
      where: { documentId },
      data: {
        pgBossJobId: job.id,
        workerId,
        status: 'PROCESSING',
        startedAt: new Date(),
        attempts: { increment: 1 },
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
      include: { collection: true, processingJob: true },
    })

    if (!document) {
      throw new Error('Document not found')
    }

    // Get or initialize metadata
    const metadata: ProcessingMetadata =
      (document.processingJob?.metadata as ProcessingMetadata) || {}

    // Step 1: Extract text (if not already done)
    let extractedText = document.extractedText
    let pageCount = document.pageCount
    let wordCount = document.wordCount
    let title = document.title
    let author = document.author

    if (!metadata.textExtracted) {
      logger.info('Step 1: Extracting text', { documentId })

      const minio = getMinIOClient()
      const fileBuffer = await minio.downloadFile(document.filename)

      const extractor = getTextExtractor()
      const {
        text,
        metadata: extractionMetadata,
        isScanned,
      } = await extractor.extractText(fileBuffer, document.mimeType)
      extractedText = extractor.cleanText(text)

      // Check if text extraction failed
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error(
          'Failed to extract text from document. The document may be empty, corrupted, or in an unsupported format.'
        )
      }

      pageCount = extractionMetadata?.pageCount || null
      wordCount = extractionMetadata?.wordCount || null
      title = extractionMetadata?.title || document.originalName
      author = extractionMetadata?.author || null

      logger.info('Text extracted', {
        documentId,
        textLength: extractedText.length,
        isScanned,
        pageCount,
        wordCount,
      })

      // Save extracted text to database
      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractedText,
          pageCount,
          wordCount,
          title,
          author,
        },
      })

      // Update metadata
      metadata.textExtracted = true
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          metadata: metadata as Record<string, unknown>,
          currentStep: 'text_extracted',
        },
      })
    } else {
      logger.info('Skipping text extraction (already done)', { documentId })
    }

    // Step 2: Chunk text (if not already done)
    let chunksWithTokens
    if (!metadata.chunksCreated) {
      logger.info('Step 2: Chunking text', { documentId })

      const chunker = getChunkingService()

      // Use token-based chunking (500 tokens, 0 overlap) matching Emate backend
      const chunks = chunker.chunkTextByTokens(extractedText!, 500, 0)

      logger.info('Chunks created', {
        documentId,
        chunkCount: chunks.length,
      })

      // Add estimated token counts (actual counts will come from OpenAI)
      chunksWithTokens = chunker.addTokenCounts(chunks)

      // Store chunks in database
      await Promise.all(
        chunksWithTokens.map((chunk) =>
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

      // Update metadata
      metadata.chunksCreated = true
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          metadata: metadata as Record<string, unknown>,
          currentStep: 'chunks_created',
        },
      })
    } else {
      logger.info('Skipping chunking (already done)', { documentId })

      // Load chunks from database
      const dbChunks = await prisma.documentChunk.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' },
      })

      chunksWithTokens = dbChunks.map((chunk: { content: string; chunkIndex: number; startChar: number | null; endChar: number | null; tokenCount: number | null }) => ({
        content: chunk.content,
        index: chunk.chunkIndex,
        startChar: chunk.startChar || 0,
        endChar: chunk.endChar || 0,
        tokenCount: chunk.tokenCount || 0,
      }))
    }

    // Step 3: Generate embeddings (if not already done)
    let embeddings
    if (!metadata.embeddingsGenerated) {
      logger.info('Step 3: Generating embeddings', { documentId })

      const embeddingService = getEmbeddingService()
      const chunkTexts = chunksWithTokens.map((c: { content: string }) => c.content)

      const result = await embeddingService.generateBatchEmbeddings(
        chunkTexts,
        document.collection.embeddingModel as EmbeddingModel
      )

      embeddings = result.embeddings

      logger.info('Embeddings generated', {
        documentId,
        embeddingCount: embeddings.length,
        tokensUsed: result.usage.totalTokens,
      })

      // Update metadata
      metadata.embeddingsGenerated = true
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          metadata: metadata as Record<string, unknown>,
          currentStep: 'embeddings_generated',
        },
      })
    } else {
      logger.info('Embeddings already generated, regenerating for storage', {
        documentId,
      })

      // Need to regenerate embeddings for storage (we don't store them in DB)
      const embeddingService = getEmbeddingService()
      const chunkTexts = chunksWithTokens.map((c: { content: string }) => c.content)

      const result = await embeddingService.generateBatchEmbeddings(
        chunkTexts,
        document.collection.embeddingModel as EmbeddingModel
      )

      embeddings = result.embeddings
    }

    // Step 4: Store vectors in Qdrant (if not already done)
    if (!metadata.vectorsStored) {
      logger.info('Step 4: Storing vectors in Qdrant', { documentId })

      const documentChunks = await prisma.documentChunk.findMany({
        where: { documentId },
        orderBy: { chunkIndex: 'asc' },
      })

      const qdrant = getQdrantClient()
      const vectorData = documentChunks.map((chunk: { id: string; chunkIndex: number; content: string; startPage: number | null; endPage: number | null }, index: number) => ({
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
        document.collection.embeddingModel as EmbeddingModel
      )

      // Update chunks with vector IDs
      await Promise.all(
        documentChunks.map((chunk: { id: string }) =>
          prisma.documentChunk.update({
            where: { id: chunk.id },
            data: { vectorId: chunk.id },
          })
        )
      )

      logger.info('Vectors stored in Qdrant', {
        documentId,
        vectorCount: vectorData.length,
      })

      // Update metadata
      metadata.vectorsStored = true
      await prisma.processingJob.update({
        where: { documentId },
        data: {
          metadata: metadata as Record<string, unknown>,
          currentStep: 'vectors_stored',
        },
      })
    } else {
      logger.info('Skipping vector storage (already done)', { documentId })
    }

    // Final: Mark as completed
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'COMPLETED',
        embeddingModel: document.collection.embeddingModel,
        totalChunks: chunksWithTokens.length,
        processedAt: new Date(),
      },
    })

    await prisma.processingJob.update({
      where: { documentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        currentStep: 'completed',
      },
    })

    logger.info('Document processing completed', { documentId, jobId: job.id })
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logger.error('Document processing failed', error, {
      documentId,
      errorMessage,
    })

    // Update document status
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'FAILED',
        processingError: errorMessage,
      },
    })

    // Update job status
    const jobRecord = await prisma.processingJob.findUnique({
      where: { documentId },
    })

    if (jobRecord) {
      const metadata: ProcessingMetadata =
        (jobRecord.metadata as ProcessingMetadata) || {}
      metadata.lastError = errorMessage

      await prisma.processingJob.update({
        where: { documentId },
        data: {
          status: 'FAILED',
          error: errorMessage,
          failedAt: new Date(),
          metadata: metadata as Record<string, unknown>,
        },
      })
    }

    // Re-throw to let pg-boss handle retry
    throw error
  }
}

/**
 * Start the worker
 */
async function startWorker() {
  logger.info('Starting document processing worker...')

  try {
    const boss = await getPgBoss()

    // Subscribe to process-document queue
    await boss.work(
      'process-document',
      {
        batchSize: 1, // Process one job at a time
        pollingIntervalSeconds: 2, // Poll every 2 seconds
      },
      async (jobs) => {
        // Process each job in the batch
        for (const job of jobs) {
          await processDocumentJob({
            id: job.id,
            data: job.data as DocumentProcessingJobData,
          })
        }
      }
    )

    logger.info('Worker started and listening for jobs')

    // Keep process alive
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...')
      await boss.stop()
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...')
      await boss.stop()
      process.exit(0)
    })
  } catch (error) {
    logger.error('Failed to start worker', error)
    process.exit(1)
  }
}

// Start if this is the main module
if (require.main === module) {
  startWorker().catch((error) => {
    logger.error('Worker crashed', error)
    process.exit(1)
  })
}

export { processDocumentJob, startWorker }
