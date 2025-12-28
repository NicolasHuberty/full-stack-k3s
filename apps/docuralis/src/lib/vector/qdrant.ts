/* eslint-disable @typescript-eslint/no-explicit-any */
import { QdrantClient } from '@qdrant/js-client-rest'
import { createHash } from 'crypto'

// Vector dimensions for different embedding models
const EMBEDDING_DIMENSIONS = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
}

/**
 * Convert CUID to a deterministic UUID format
 * Qdrant requires IDs to be either UUID or unsigned integers
 */
function cuidToUuid(cuid: string): string {
  // Create a deterministic hash of the CUID
  const hash = createHash('md5').update(cuid).digest('hex')

  // Format as UUID v4
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`
}

export interface DocumentChunkVector {
  id: string
  vector: number[]
  payload: {
    documentId: string
    collectionId: string
    chunkIndex: number
    content: string
    documentName?: string
    page_number?: number // Direct page number field (for migrated documents)
    pageNumber?: number // Alternative naming
    metadata?: Record<string, any>
  }
}

export interface SearchResult {
  id: string
  score: number
  payload: {
    documentId: string
    collectionId: string
    chunkIndex: number
    content: string
    documentName?: string
    page_number?: number // Direct page number field (for migrated documents)
    pageNumber?: number // Alternative naming
    metadata?: Record<string, any>
  }
}

class QdrantService {
  private client: QdrantClient
  constructor() {
    this.client = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      port: 443, // Explicitly set port to override default 6333
      apiKey: process.env.QDRANT_API_KEY,
    })
  }

  /**
   * Create a collection in Qdrant with the specified embedding model
   */
  async createCollection(
    collectionName: string,
    embeddingModel: keyof typeof EMBEDDING_DIMENSIONS = 'text-embedding-3-small'
  ): Promise<void> {
    try {
      const exists = await this.collectionExists(collectionName)
      if (exists) {
        console.log(`Collection ${collectionName} already exists`)
        return
      }

      const vectorSize = EMBEDDING_DIMENSIONS[embeddingModel]
      if (!vectorSize) {
        throw new Error(`Unsupported embedding model: ${embeddingModel}`)
      }

      await this.client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      })

      // Create payload indexes for faster filtering
      console.log(
        `Creating payload indexes for collection ${collectionName}...`
      )
      await this.createPayloadIndexes(collectionName)

      console.log(
        `Collection ${collectionName} created with vector size ${vectorSize}`
      )
    } catch (error) {
      console.error('Failed to create collection:', error)
      throw new Error(
        `Failed to create collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Create payload indexes for faster filtering
   */
  async createPayloadIndexes(collectionName: string): Promise<void> {
    try {
      // Index collectionId for filtering (most important for multi-tenant)
      await this.client.createPayloadIndex(collectionName, {
        field_name: 'collectionId',
        field_schema: 'keyword',
        wait: true,
      })
      console.log(`  ✓ Created index on 'collectionId'`)

      // Index documentId for document-level filtering
      await this.client.createPayloadIndex(collectionName, {
        field_name: 'documentId',
        field_schema: 'keyword',
        wait: true,
      })
      console.log(`  ✓ Created index on 'documentId'`)

      // Index chunkIndex for ordering
      await this.client.createPayloadIndex(collectionName, {
        field_name: 'chunkIndex',
        field_schema: 'integer',
        wait: true,
      })
      console.log(`  ✓ Created index on 'chunkIndex'`)
    } catch (error) {
      console.error('Failed to create payload indexes:', error)
      // Don't throw - indexes are optional optimization
    }
  }

  /**
   * Ensure indexes exist on a collection (for existing collections)
   */
  async ensurePayloadIndexes(collectionName: string): Promise<void> {
    try {
      const info = await this.client.getCollection(collectionName)
      const existingIndexes = Object.keys(info.payload_schema || {})

      if (!existingIndexes.includes('collectionId')) {
        console.log(
          `Creating missing index 'collectionId' on ${collectionName}...`
        )
        await this.client.createPayloadIndex(collectionName, {
          field_name: 'collectionId',
          field_schema: 'keyword',
          wait: true,
        })
      }

      if (!existingIndexes.includes('documentId')) {
        console.log(
          `Creating missing index 'documentId' on ${collectionName}...`
        )
        await this.client.createPayloadIndex(collectionName, {
          field_name: 'documentId',
          field_schema: 'keyword',
          wait: true,
        })
      }

      console.log(`Indexes verified for collection ${collectionName}`)
    } catch (error) {
      console.error('Failed to ensure payload indexes:', error)
    }
  }

  /**
   * Check if a collection exists
   */
  async collectionExists(collectionName: string): Promise<boolean> {
    try {
      const collections = await this.client.getCollections()
      return collections.collections.some((c) => c.name === collectionName)
    } catch (error) {
      console.error('Failed to check collection existence:', error)
      return false
    }
  }

  /**
   * Delete a collection
   */
  async deleteCollection(collectionName: string): Promise<void> {
    try {
      await this.client.deleteCollection(collectionName)
      console.log(`Collection ${collectionName} deleted`)
    } catch (error) {
      console.error('Failed to delete collection:', error)
      throw new Error(
        `Failed to delete collection: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Upsert document chunks into Qdrant
   */
  async upsertChunks(
    collectionName: string,
    chunks: DocumentChunkVector[],
    embeddingModel: keyof typeof EMBEDDING_DIMENSIONS = 'text-embedding-3-small'
  ): Promise<void> {
    try {
      // Ensure collection exists, create if not
      const exists = await this.collectionExists(collectionName)
      if (!exists) {
        console.log(`Collection ${collectionName} does not exist, creating...`)
        await this.createCollection(collectionName, embeddingModel)
      }

      if (chunks.length === 0) {
        console.log('No chunks to upsert')
        return
      }

      // Validate chunks before upserting
      const validChunks = chunks.filter((chunk) => {
        if (!chunk.id || !chunk.vector || chunk.vector.length === 0) {
          console.warn('Invalid chunk detected:', {
            id: chunk.id,
            vectorLength: chunk.vector?.length,
          })
          return false
        }
        return true
      })

      if (validChunks.length === 0) {
        throw new Error('No valid chunks to upsert')
      }

      // Batch upsert - Qdrant requires numeric IDs or UUIDs
      // Convert CUID to UUID format and store original ID in payload
      const points = validChunks.map((chunk) => ({
        id: cuidToUuid(chunk.id), // Convert CUID to UUID
        vector: chunk.vector,
        payload: {
          ...chunk.payload,
          chunkId: chunk.id, // Store original CUID in payload
        },
      }))

      console.log(
        `Upserting ${points.length} chunks to collection ${collectionName}`
      )
      console.log(
        'Sample point:',
        points[0]
          ? {
              id: points[0].id,
              vectorLength: points[0].vector.length,
              payloadKeys: Object.keys(points[0].payload),
            }
          : 'no points'
      )

      await this.client.upsert(collectionName, {
        wait: true,
        points,
      })

      console.log(
        `Successfully upserted ${points.length} chunks to collection ${collectionName}`
      )
    } catch (error) {
      console.error('Failed to upsert chunks:', error)

      // Log more details for debugging
      if (error && typeof error === 'object') {
        const err = error as any
        if ('data' in err) {
          console.error('Error data:', JSON.stringify(err.data, null, 2))
        }
        if ('response' in err) {
          console.error('Error response:', err.response)
        }
        if ('status' in err) {
          console.error('Error status:', err.status)
        }
      }

      throw new Error(
        `Failed to upsert chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Delete document chunks from Qdrant
   */
  async deleteDocumentChunks(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    try {
      await this.client.delete(collectionName, {
        wait: true,
        filter: {
          must: [
            {
              key: 'documentId',
              match: {
                value: documentId,
              },
            },
          ],
        },
      })

      console.log(
        `Deleted chunks for document ${documentId} from collection ${collectionName}`
      )
    } catch (error) {
      console.error('Failed to delete document chunks:', error)
      throw new Error(
        `Failed to delete chunks: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Search for similar chunks using vector similarity
   */
  async searchSimilar(
    collectionName: string,
    queryVector: number[],
    limit: number = 10,
    filter?: {
      collectionId?: string
      documentId?: string
    }
  ): Promise<SearchResult[]> {
    try {
      const qdrantFilter: any = {}

      if (filter) {
        qdrantFilter.must = []

        if (filter.collectionId) {
          qdrantFilter.must.push({
            key: 'collectionId',
            match: { value: filter.collectionId },
          })
        }

        if (filter.documentId) {
          qdrantFilter.must.push({
            key: 'documentId',
            match: { value: filter.documentId },
          })
        }
      }

      // DEBUG: Log search parameters
      console.log('\n' + '='.repeat(80))
      console.log('[Qdrant DEBUG] Search Parameters:')
      console.log('  Collection:', collectionName)
      console.log('  Query vector length:', queryVector.length)
      console.log('  Query vector sample (first 5):', queryVector.slice(0, 5))
      console.log('  Limit:', limit)
      console.log('  Filter:', JSON.stringify(filter, null, 2))
      console.log('='.repeat(80))

      const results = await this.client.search(collectionName, {
        vector: queryVector,
        limit,
        filter: Object.keys(qdrantFilter).length > 0 ? qdrantFilter : undefined,
        with_payload: true,
      })

      const mappedResults = results.map((result) => ({
        id: result.id as string,
        score: result.score,
        payload: result.payload as any,
      }))

      // DEBUG: Log ALL results with scores
      console.log('\n' + '='.repeat(80))
      console.log(
        `[Qdrant DEBUG] Search Results (${mappedResults.length} total):`
      )
      console.log('-'.repeat(80))

      // Score distribution
      const scores = mappedResults.map((r) => r.score)
      console.log('  Score distribution:')
      console.log('    Min:', Math.min(...scores).toFixed(4))
      console.log('    Max:', Math.max(...scores).toFixed(4))
      console.log(
        '    Avg:',
        (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(4)
      )
      console.log('-'.repeat(80))

      // Log each result
      mappedResults.forEach((result, idx) => {
        const contentPreview =
          result.payload.content?.substring(0, 150)?.replace(/\n/g, ' ') ||
          'N/A'
        console.log(`  [${idx + 1}] Score: ${result.score.toFixed(4)}`)
        console.log(`      Doc: ${result.payload.documentId}`)
        console.log(
          `      Page: ${result.payload.page_number || result.payload.pageNumber || 'N/A'}`
        )
        console.log(`      Content: ${contentPreview}...`)
        console.log('')
      })
      console.log('='.repeat(80) + '\n')

      return mappedResults
    } catch (error) {
      console.error('Failed to search similar chunks:', error)
      throw new Error(
        `Failed to search: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(collectionName: string) {
    try {
      return await this.client.getCollection(collectionName)
    } catch (error) {
      console.error('Failed to get collection info:', error)
      throw new Error(
        `Failed to get collection info: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Count points in collection
   */
  async countPoints(collectionName: string): Promise<number> {
    try {
      const result = await this.client.count(collectionName)
      return result.count
    } catch (error) {
      console.error('Failed to count points:', error)
      return 0
    }
  }
}

// Singleton instance
let qdrantService: QdrantService | null = null

export function getQdrantClient(): QdrantService {
  if (!qdrantService) {
    qdrantService = new QdrantService()
  }
  return qdrantService
}

export type { QdrantService }
