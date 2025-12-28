/**
 * Jurisprudence RAG Tool - Qdrant Vector Search
 *
 * Searches Belgian jurisprudence stored in Qdrant vector database.
 * Uses semantic similarity to find relevant legal cases.
 */

import { getQdrantClient } from '@/lib/vector/qdrant'
import { getEmbeddingService } from '@/lib/processing/embeddings'
import { prisma } from '@/lib/prisma'
import {
  ToolDefinition,
  ToolResult,
  JurisprudenceDocument,
  JurisprudenceSearchResult,
  BELGIAN_COURTS,
} from './types'

// Jurisprudence collection name in Qdrant
const JURISPRUDENCE_COLLECTION = 'jurisprudence'

// Tool Definition for LLM
export const jurisprudenceRagToolDefinition: ToolDefinition = {
  name: 'search_jurisprudence_rag',
  description: `Search Belgian jurisprudence using semantic vector search (RAG).
This tool uses AI embeddings to find semantically similar legal cases from the local database.
It's faster than JUPORTAL web search and works offline.

Best for:
- Finding similar case law by topic
- Searching by legal concepts
- Quick semantic search across stored jurisprudence

Returns ECLI identifiers, court names, summaries, and relevance scores.`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Natural language query describing the legal topic or case you are looking for',
      },
      courtCodes: {
        type: 'array',
        description:
          'Optional: Filter by court codes (CASS, RVSCE, GHCC, etc.)',
        items: { type: 'string' },
      },
      topK: {
        type: 'number',
        description: 'Number of results to return (default: 10, max: 50)',
        default: 10,
      },
      minScore: {
        type: 'number',
        description: 'Minimum similarity score threshold (0-1, default: 0.5)',
        default: 0.5,
      },
      language: {
        type: 'string',
        description: 'Filter by language: FR, NL, or DE',
        enum: ['FR', 'NL', 'DE'],
      },
    },
    required: ['query'],
  },
}

interface JurisprudenceRagParams {
  query: string
  courtCodes?: string[]
  topK?: number
  minScore?: number
  language?: string
}

/**
 * Parse ECLI to extract metadata
 */
function parseEcli(ecli: string): {
  courtCode: string
  year: string
  caseNumber: string
} {
  // ECLI format: ECLI:BE:COURT:YEAR:CASE_NUMBER
  const parts = ecli.split(':')
  return {
    courtCode: parts[2] || '',
    year: parts[3] || '',
    caseNumber: parts[4] || '',
  }
}

/**
 * Execute Qdrant RAG search for jurisprudence
 */
export async function executeJurisprudenceRagSearch(
  params: JurisprudenceRagParams
): Promise<ToolResult<JurisprudenceSearchResult>> {
  const startTime = Date.now()
  const { query, courtCodes, topK = 10, minScore = 0.5, language } = params

  console.log('[JURISPRUDENCE-RAG] Executing search:', {
    query,
    courtCodes,
    topK,
    minScore,
    language,
  })

  try {
    // Step 1: Check if jurisprudence collection exists
    const qdrant = getQdrantClient()
    const collectionExists = await qdrant.collectionExists(
      JURISPRUDENCE_COLLECTION
    )

    if (!collectionExists) {
      console.log(
        '[JURISPRUDENCE-RAG] Collection does not exist, falling back to standard search'
      )
      return {
        success: true,
        data: {
          query,
          totalCount: 0,
          documents: [],
          fetchedAt: new Date().toISOString(),
          source: 'qdrant',
        },
        metadata: {
          durationMs: Date.now() - startTime,
          source: 'qdrant',
          itemCount: 0,
        },
      }
    }

    // Step 2: Generate query embedding
    const embeddingService = getEmbeddingService()
    const queryEmbedding = await embeddingService.generateQueryEmbedding(
      query,
      'text-embedding-3-large'
    )

    console.log('[JURISPRUDENCE-RAG] Generated embedding, searching...')

    // Step 3: Build filter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const filter: any = { must: [] }

    if (courtCodes && courtCodes.length > 0) {
      filter.must.push({
        key: 'court_code',
        match: { any: courtCodes },
      })
    }

    if (language) {
      filter.must.push({
        key: 'language',
        match: { value: language },
      })
    }

    // Step 4: Execute vector search
    const searchLimit = Math.min(topK * 2, 100) // Fetch more for filtering
    const results = await qdrant.searchSimilar(
      JURISPRUDENCE_COLLECTION,
      queryEmbedding,
      searchLimit,
      filter.must.length > 0
        ? { collectionId: JURISPRUDENCE_COLLECTION }
        : undefined
    )

    console.log(`[JURISPRUDENCE-RAG] Found ${results.length} raw results`)

    // Step 5: Filter by minimum score and transform results
    const documents: JurisprudenceDocument[] = results
      .filter((result) => result.score >= minScore)
      .slice(0, topK)
      .map((result) => {
        // Cast payload to a flexible type for jurisprudence-specific fields
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = result.payload as Record<string, any>
        const ecli = (payload.ecli as string) || ''
        const ecliParts = parseEcli(ecli)

        return {
          ecli,
          courtCode: (payload.court_code as string) || ecliParts.courtCode,
          courtName:
            (payload.court_name as string) ||
            BELGIAN_COURTS[ecliParts.courtCode] ||
            ecliParts.courtCode,
          decisionDate: (payload.decision_date as string) || '',
          roleNumber: (payload.role_number as string) || '',
          summary:
            (payload.content as string) || (payload.summary as string) || '',
          thesaurusCas: (payload.thesaurus_cas as string[]) || [],
          thesaurusUtu: (payload.thesaurus_utu as string[]) || [],
          keywords: (payload.keywords as string[]) || [],
          consultationCount: (payload.consultation_count as number) || 0,
          url:
            (payload.url as string) || `https://juportal.be/content/${ecli}/FR`,
          iubelId: (payload.iubel_id as string) || '',
          language: (payload.language as string) || 'FR',
          score: result.score,
        }
      })

    const durationMs = Date.now() - startTime
    console.log(
      `[JURISPRUDENCE-RAG] Search completed: ${documents.length} results in ${durationMs}ms`
    )

    return {
      success: true,
      data: {
        query,
        totalCount: documents.length,
        documents,
        fetchedAt: new Date().toISOString(),
        source: 'qdrant',
      },
      metadata: {
        durationMs,
        source: 'qdrant',
        itemCount: documents.length,
      },
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('[JURISPRUDENCE-RAG] Search failed:', errorMessage)

    return {
      success: false,
      error: errorMessage,
      metadata: {
        durationMs,
        source: 'qdrant',
      },
    }
  }
}

/**
 * Search jurisprudence in a specific collection (for collection-based RAG)
 */
export async function searchCollectionJurisprudence(
  collectionId: string,
  query: string,
  topK: number = 10
): Promise<ToolResult<JurisprudenceSearchResult>> {
  const startTime = Date.now()

  console.log('[COLLECTION-RAG] Searching jurisprudence in collection:', {
    collectionId,
    query,
    topK,
  })

  try {
    // Get collection and verify it exists
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
    })

    if (!collection) {
      throw new Error('Collection not found')
    }

    // Generate query embedding
    const embeddingService = getEmbeddingService()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const embeddingModel = collection.embeddingModel as any
    const queryEmbedding = await embeddingService.generateQueryEmbedding(
      query,
      embeddingModel
    )

    // Search in Qdrant
    const qdrant = getQdrantClient()
    const results = await qdrant.searchSimilar(
      collectionId,
      queryEmbedding,
      topK,
      { collectionId }
    )

    // Get document names
    const documentIds = [...new Set(results.map((r) => r.payload.documentId))]
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds as string[] } },
      select: { id: true, originalName: true, language: true, title: true },
    })

    const docMap = new Map(documents.map((d) => [d.id, d]))

    // Transform results to jurisprudence format
    const jurisprudenceDocs: JurisprudenceDocument[] = results.map((result) => {
      const doc = docMap.get(result.payload.documentId as string)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload = result.payload as Record<string, any>

      // Try to extract ECLI from document name or payload
      const ecliMatch = doc?.originalName?.match(/ECLI:BE:[A-Z]+:\d+:[^\s]+/)
      const ecli = ecliMatch ? ecliMatch[0] : (payload.ecli as string) || ''
      const ecliParts = parseEcli(ecli)

      return {
        ecli,
        courtCode: (payload.court_code as string) || ecliParts.courtCode,
        courtName:
          (payload.court_name as string) ||
          BELGIAN_COURTS[ecliParts.courtCode] ||
          ecliParts.courtCode,
        decisionDate: (payload.decision_date as string) || '',
        roleNumber: (payload.role_number as string) || '',
        summary: (payload.content as string) || '',
        thesaurusCas: (payload.thesaurus_cas as string[]) || [],
        thesaurusUtu: (payload.thesaurus_utu as string[]) || [],
        keywords: (payload.keywords as string[]) || [],
        consultationCount: (payload.consultation_count as number) || 0,
        url:
          (payload.url as string) ||
          (ecli ? `https://juportal.be/content/${ecli}/FR` : ''),
        iubelId: (payload.iubel_id as string) || '',
        language: doc?.language || (payload.language as string) || 'FR',
        score: result.score,
      }
    })

    const durationMs = Date.now() - startTime
    console.log(
      `[COLLECTION-RAG] Search completed: ${jurisprudenceDocs.length} results in ${durationMs}ms`
    )

    return {
      success: true,
      data: {
        query,
        totalCount: jurisprudenceDocs.length,
        documents: jurisprudenceDocs,
        fetchedAt: new Date().toISOString(),
        source: 'qdrant',
      },
      metadata: {
        durationMs,
        source: 'qdrant',
        itemCount: jurisprudenceDocs.length,
      },
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('[COLLECTION-RAG] Search failed:', errorMessage)

    return {
      success: false,
      error: errorMessage,
      metadata: {
        durationMs,
        source: 'qdrant',
      },
    }
  }
}

/**
 * Get jurisprudence collection stats
 */
export async function getJurisprudenceStats(): Promise<{
  totalDocuments: number
  collectionExists: boolean
}> {
  try {
    const qdrant = getQdrantClient()
    const exists = await qdrant.collectionExists(JURISPRUDENCE_COLLECTION)

    if (!exists) {
      return { totalDocuments: 0, collectionExists: false }
    }

    const count = await qdrant.countPoints(JURISPRUDENCE_COLLECTION)
    return { totalDocuments: count, collectionExists: true }
  } catch (error) {
    console.error('[JURISPRUDENCE-RAG] Failed to get stats:', error)
    return { totalDocuments: 0, collectionExists: false }
  }
}
