import OpenAI from 'openai'

export type EmbeddingModel =
  | 'text-embedding-3-small'
  | 'text-embedding-3-large'
  | 'text-embedding-ada-002'

export interface EmbeddingResult {
  embedding: number[]
  model: string
  usage: {
    promptTokens: number
    totalTokens: number
  }
}

export interface BatchEmbeddingResult {
  embeddings: number[][]
  model: string
  usage: {
    promptTokens: number
    totalTokens: number
  }
}

export class EmbeddingService {
  private openai: OpenAI

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(
    text: string,
    model: EmbeddingModel = 'text-embedding-3-small'
  ): Promise<EmbeddingResult> {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty')
      }

      const response = await this.openai.embeddings.create({
        model,
        input: text,
      })

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding returned from OpenAI')
      }

      return {
        embedding: response.data[0].embedding,
        model: response.model,
        usage: {
          promptTokens: response.usage.prompt_tokens,
          totalTokens: response.usage.total_tokens,
        },
      }
    } catch (error) {
      console.error('Failed to generate embedding:', error)
      throw new Error(
        `Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Generate embeddings for multiple texts (batch)
   */
  async generateBatchEmbeddings(
    texts: string[],
    model: EmbeddingModel = 'text-embedding-3-small',
    batchSize: number = 100
  ): Promise<BatchEmbeddingResult> {
    try {
      if (!texts || texts.length === 0) {
        throw new Error('Texts array cannot be empty')
      }

      // Filter out empty texts
      const validTexts = texts.filter((text) => text && text.trim().length > 0)

      if (validTexts.length === 0) {
        throw new Error('No valid texts to embed')
      }

      // Process in batches if necessary
      const allEmbeddings: number[][] = []
      let totalPromptTokens = 0
      let totalTokens = 0

      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, i + batchSize)

        const response = await this.openai.embeddings.create({
          model,
          input: batch,
        })

        if (!response.data || response.data.length === 0) {
          throw new Error('No embeddings returned from OpenAI')
        }

        // Collect embeddings in order
        const batchEmbeddings = response.data.map((item) => item.embedding)
        allEmbeddings.push(...batchEmbeddings)

        totalPromptTokens += response.usage.prompt_tokens
        totalTokens += response.usage.total_tokens
      }

      return {
        embeddings: allEmbeddings,
        model,
        usage: {
          promptTokens: totalPromptTokens,
          totalTokens: totalTokens,
        },
      }
    } catch (error) {
      console.error('Failed to generate batch embeddings:', error)
      throw new Error(
        `Batch embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Generate embedding for a query (optimized for search)
   */
  async generateQueryEmbedding(
    query: string,
    model: EmbeddingModel = 'text-embedding-3-small'
  ): Promise<number[]> {
    try {
      const result = await this.generateEmbedding(query, model)
      return result.embedding
    } catch (error) {
      console.error('Failed to generate query embedding:', error)
      throw error
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same length')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  /**
   * Get the dimension size for a specific model
   */
  getModelDimension(model: EmbeddingModel): number {
    const dimensions: Record<EmbeddingModel, number> = {
      'text-embedding-3-small': 1536,
      'text-embedding-3-large': 3072,
      'text-embedding-ada-002': 1536,
    }
    return dimensions[model]
  }
}

// Singleton instance
let embeddingService: EmbeddingService | null = null

export function getEmbeddingService(): EmbeddingService {
  if (!embeddingService) {
    embeddingService = new EmbeddingService()
  }
  return embeddingService
}
