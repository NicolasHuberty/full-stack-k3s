/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'
import { getQdrantClient } from '@/lib/vector/qdrant'
import { getEmbeddingService } from '@/lib/processing/embeddings'
import { hasCollectionAccess } from '@/lib/collections/permissions'
import OpenAI from 'openai'

export interface SearchQuery {
  query: string
  collectionId: string
  limit?: number
  documentId?: string
}

export interface SearchResult {
  chunks: Array<{
    id: string
    content: string
    score: number
    documentId: string
    documentName: string
    chunkIndex: number
  }>
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatRequest {
  collectionId?: string
  sessionId?: string
  message: string
  userId: string
  model?: string
  maxTokens?: number
}

export interface ChatResponse {
  sessionId: string
  message: string
  chunks: any[]
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export class RAGService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  /**
   * Search for relevant document chunks using vector similarity
   */
  async search(params: SearchQuery, userId: string): Promise<SearchResult> {
    try {
      // Check access permission
      const hasAccess = await hasCollectionAccess(
        userId,
        params.collectionId,
        'read'
      )
      if (!hasAccess) {
        throw new Error('You do not have access to this collection')
      }

      // Get collection
      const collection = await prisma.collection.findUnique({
        where: { id: params.collectionId },
      })

      if (!collection) {
        throw new Error('Collection not found')
      }

      // Generate query embedding
      const embeddingService = getEmbeddingService()
      const queryEmbedding = await embeddingService.generateQueryEmbedding(
        params.query,
        collection.embeddingModel as any
      )

      // Search in Qdrant
      const qdrant = getQdrantClient()
      const results = await qdrant.searchSimilar(
        params.collectionId,
        queryEmbedding,
        params.limit || 10,
        {
          collectionId: params.collectionId,
          documentId: params.documentId,
        }
      )

      // Get document names
      const documentIds = [...new Set(results.map((r) => r.payload.documentId))]
      const documents = await prisma.document.findMany({
        where: { id: { in: documentIds } },
        select: { id: true, originalName: true },
      })

      const docMap = new Map(
        documents.map((d: { id: string; originalName: string }) => [
          d.id,
          d.originalName,
        ])
      )

      // Format results
      const chunks = results.map(
        (
          result
        ): {
          id: string
          content: string
          score: number
          documentId: string
          documentName: string
          chunkIndex: number
          pageNumber: number | null
          metadata: {
            pageNumber: number | null
            title: string
            source: string
          }
        } => {
          const documentName = (docMap.get(result.payload.documentId) ||
            'Unknown') as string
          return {
            id: result.id,
            content: result.payload.content,
            score: result.score,
            documentId: result.payload.documentId,
            documentName,
            chunkIndex: result.payload.chunkIndex,
            pageNumber:
              result.payload.page_number || result.payload.pageNumber || null,
            metadata: {
              pageNumber:
                result.payload.page_number || result.payload.pageNumber || null,
              title: (docMap.get(result.payload.documentId) ||
                'Unknown') as string,
              source: (docMap.get(result.payload.documentId) ||
                'Unknown') as string,
            },
          }
        }
      )

      return { chunks }
    } catch (error) {
      console.error('Search failed:', error)
      throw error
    }
  }

  /**
   * Chat with documents using RAG
   */
  async chat(params: ChatRequest): Promise<ChatResponse> {
    try {
      let session: any

      // Get or create session
      if (params.sessionId) {
        session = await prisma.chatSession.findUnique({
          where: { id: params.sessionId },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
              take: 20, // Last 20 messages for context
            },
          },
        })

        if (!session) {
          throw new Error('Session not found')
        }
      } else {
        // Create new session
        session = await prisma.chatSession.create({
          data: {
            userId: params.userId,
            collectionId: params.collectionId,
            title: params.message.substring(0, 100),
          },
          include: {
            messages: true,
          },
        })
      }

      // Search for relevant chunks if collection is provided
      let relevantChunks: any[] = []
      let context = ''

      if (params.collectionId || session.collectionId) {
        const collectionId = params.collectionId || session.collectionId

        // Check access
        const hasAccess = await hasCollectionAccess(
          params.userId,
          collectionId,
          'read'
        )
        if (!hasAccess) {
          throw new Error('You do not have access to this collection')
        }

        const searchResult = await this.search(
          {
            query: params.message,
            collectionId,
            limit: 5,
          },
          params.userId
        )

        relevantChunks = searchResult.chunks.map((chunk: any) => ({
          ...chunk,
          // Ensure page number is at top level for frontend compatibility
          pageNumber: chunk.metadata?.pageNumber || chunk.pageNumber || null,
          documentName:
            chunk.metadata?.title ||
            chunk.metadata?.source ||
            chunk.documentName ||
            'Unknown Document',
          content: chunk.pageContent || chunk.content,
        }))

        // Build context from chunks
        if (relevantChunks.length > 0) {
          context = relevantChunks
            .map(
              (chunk, i) =>
                `[${i + 1}] From "${chunk.documentName}":\n${chunk.content}`
            )
            .join('\n\n')
        } else {
          console.warn('No relevant chunks found in collection!')
        }
      } else {
        console.warn('No collection ID provided for RAG search')
      }

      // Build messages for OpenAI
      const messages: ChatMessage[] = []

      // System message with context
      if (context) {
        messages.push({
          role: 'system',
          content: `You are a helpful assistant that answers questions based on the provided documents. Use the following context to answer the user's question. If the answer is not in the context, say so.

Context:
${context}`,
        })
      } else {
        messages.push({
          role: 'system',
          content: 'You are a helpful assistant.',
        })
      }

      // Add conversation history
      session.messages.forEach((msg: any) => {
        messages.push({
          role: msg.role.toLowerCase() as 'user' | 'assistant',
          content: msg.content,
        })
      })

      // Add current message
      messages.push({
        role: 'user',
        content: params.message,
      })

      // Call OpenAI
      const completion = await this.openai.chat.completions.create({
        model: params.model || 'gpt-4o-mini',
        messages,
        max_completion_tokens: params.maxTokens || 1000,
      })

      const assistantMessage = completion.choices[0]?.message?.content || ''

      if (!assistantMessage) {
        console.error(
          'No content in OpenAI response!',
          JSON.stringify(completion, null, 2)
        )
        throw new Error('OpenAI returned empty response')
      }

      // Save user message (without chunks)
      await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'USER',
          content: params.message,
        },
      })

      // Save assistant message (with source chunks)
      const assistantMsg = await prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          role: 'ASSISTANT',
          content: assistantMessage || '',
          documentChunks:
            relevantChunks.length > 0
              ? JSON.parse(JSON.stringify(relevantChunks))
              : undefined,
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
        },
      })

      // Update session title if first message
      if (session.messages.length === 0) {
        await prisma.chatSession.update({
          where: { id: session.id },
          data: { title: params.message.substring(0, 100) },
        })
      }

      return {
        sessionId: session.id,
        message: assistantMessage,
        chunks: relevantChunks,
        usage: {
          promptTokens: completion.usage?.prompt_tokens || 0,
          completionTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      }
    } catch (error) {
      console.error('Chat failed:', error)
      throw error
    }
  }

  /**
   * Get chat session history
   */
  async getSession(sessionId: string, userId: string) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: 'asc' },
          },
          collection: {
            select: {
              id: true,
              name: true,
            },
          },
          sharedWith: {
            select: {
              userId: true,
            },
          },
        },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      // Check if user is owner or has shared access
      const isOwner = session.userId === userId
      const hasSharedAccess = session.sharedWith.some(
        (s: { userId: string }) => s.userId === userId
      )

      if (!isOwner && !hasSharedAccess) {
        throw new Error('You do not have access to this session')
      }

      return session
    } catch (error) {
      console.error('Failed to get session:', error)
      throw error
    }
  }

  /**
   * Get all chat sessions for a user
   */
  async getUserSessions(
    userId: string,
    collectionId?: string,
    filter?: 'owned' | 'shared' | 'all'
  ) {
    try {
      const filterType = filter || 'all'

      let whereClause: any = {}

      if (filterType === 'owned') {
        whereClause = {
          userId,
          ...(collectionId && { collectionId }),
        }
      } else if (filterType === 'shared') {
        whereClause = {
          sharedWith: {
            some: { userId },
          },
          ...(collectionId && { collectionId }),
        }
      } else {
        // 'all' - both owned and shared
        whereClause = {
          OR: [{ userId }, { sharedWith: { some: { userId } } }],
          ...(collectionId && { collectionId }),
        }
      }

      const sessions = await prisma.chatSession.findMany({
        where: whereClause,
        include: {
          collection: {
            select: {
              id: true,
              name: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          sharedWith: {
            select: {
              userId: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      })
      return sessions
    } catch (error) {
      console.error('Failed to get user sessions:', error)
      throw error
    }
  }

  /**
   * Update chat session title
   */
  async updateSessionTitle(sessionId: string, userId: string, title: string) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      if (session.userId !== userId) {
        throw new Error('You do not have permission to update this session')
      }

      const updatedSession = await prisma.chatSession.update({
        where: { id: sessionId },
        data: { title },
      })

      return updatedSession
    } catch (error) {
      console.error('Failed to update session title:', error)
      throw error
    }
  }

  /**
   * Delete a chat session
   */
  async deleteSession(sessionId: string, userId: string) {
    try {
      const session = await prisma.chatSession.findUnique({
        where: { id: sessionId },
      })

      if (!session) {
        throw new Error('Session not found')
      }

      if (session.userId !== userId) {
        throw new Error('You do not have permission to delete this session')
      }

      await prisma.chatSession.delete({
        where: { id: sessionId },
      })

      return { success: true }
    } catch (error) {
      console.error('Failed to delete session:', error)
      throw error
    }
  }
}

// Singleton instance
let ragService: RAGService | null = null

export function getRAGService(): RAGService {
  if (!ragService) {
    ragService = new RAGService()
  }
  return ragService
}

/**
 * Standalone function to search documents for agent use
 */
export async function searchDocuments(
  collectionId: string,
  query: string,
  limit: number = 10
): Promise<
  Array<{
    pageContent: string
    metadata: {
      title: string
      source: string
      pageNumber: number
      similarity: number
    }
  }>
> {
  try {
    // Get collection
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      throw new Error('Collection not found')
    }

    // Generate query embedding
    const embeddingService = getEmbeddingService()
    const queryEmbedding = await embeddingService.generateQueryEmbedding(
      query,
      collection.embeddingModel as any
    )

    // Search in Qdrant
    const qdrant = getQdrantClient()
    const results = await qdrant.searchSimilar(
      collectionId,
      queryEmbedding,
      limit,
      {
        collectionId: collectionId,
      }
    )

    // Get document names and chunk page information
    const documentIds = [...new Set(results.map((r) => r.payload.documentId))]
    const chunkIds = [...new Set(results.map((r) => r.id))]

    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      select: { id: true, originalName: true, filename: true },
    })

    const chunks = await prisma.documentChunk.findMany({
      where: { id: { in: chunkIds } },
      select: { id: true, startPage: true, endPage: true },
    })

    const docMap = new Map<
      string,
      { id: string; title: string; source: string; originalName: string }
    >(
      documents.map(
        (d: { id: string; originalName: string; filename: string }) => [
          d.id,
          {
            id: d.id,
            title: d.originalName,
            source: d.filename,
            originalName: d.originalName,
          },
        ]
      )
    )

    const chunkMap = new Map<
      string,
      { id: string; startPage: number | null; endPage: number | null }
    >(
      chunks.map(
        (c: {
          id: string
          startPage: number | null
          endPage: number | null
        }) => [c.id, c]
      )
    )

    // Format results to match Emate structure
    return results.map((result) => {
      const doc = docMap.get(result.payload.documentId)
      const chunk = chunkMap.get(result.id)

      // Get page number from vector payload (direct or in metadata), then fallback to database chunk info
      const pageNumber =
        result.payload.page_number || // Direct field (for migrated documents)
        result.payload.pageNumber || // Alternative naming
        result.payload.metadata?.pageNumber || // In metadata object (new documents)
        result.payload.metadata?.page_number || // Alternative naming in metadata
        chunk?.startPage || // Database fallback
        chunk?.endPage ||
        result.payload.chunkIndex ||
        0

      return {
        pageContent: result.payload.content,
        metadata: {
          documentId: doc?.id || result.payload.documentId, // Include document ID
          title: doc?.title || 'Unknown',
          source: doc?.originalName || doc?.source || 'Unknown', // Prefer originalName
          pageNumber: pageNumber,
          similarity: result.score,
        },
      }
    })
  } catch (error) {
    console.error('Search documents failed:', error)
    throw error
  }
}
