import { EmbeddingService } from '@/lib/processing/embeddings'

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      embeddings: {
        create: jest.fn().mockImplementation((params) => {
          // Handle both single and batch operations
          const inputArray = Array.isArray(params.input) ? params.input : [params.input]
          return Promise.resolve({
            data: inputArray.map(() => ({
              embedding: Array(1536).fill(0.1),
            })),
            model: 'text-embedding-3-small',
            usage: {
              prompt_tokens: 10 * inputArray.length,
              total_tokens: 10 * inputArray.length,
            },
          })
        }),
      },
    })),
  }
})

describe('EmbeddingService', () => {
  let service: EmbeddingService

  beforeEach(() => {
    service = new EmbeddingService()
    jest.clearAllMocks()
  })

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const result = await service.generateEmbedding('Test text')

      expect(result).toBeDefined()
      expect(result.embedding).toHaveLength(1536)
      expect(result.model).toBe('text-embedding-3-small')
      expect(result.usage.promptTokens).toBe(10)
    })

    it('should throw error for empty text', async () => {
      await expect(service.generateEmbedding('')).rejects.toThrow('Text cannot be empty')
    })

    it('should throw error for whitespace-only text', async () => {
      await expect(service.generateEmbedding('   ')).rejects.toThrow(
        'Text cannot be empty'
      )
    })
  })

  describe('generateBatchEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['Text one', 'Text two', 'Text three']

      const result = await service.generateBatchEmbeddings(texts)

      expect(result.embeddings).toHaveLength(3)
      expect(result.usage.promptTokens).toBeGreaterThan(0)
    })

    it('should filter out empty texts', async () => {
      const texts = ['Text one', '', '   ', 'Text two']

      const result = await service.generateBatchEmbeddings(texts)

      expect(result.embeddings).toHaveLength(2)
    })

    it('should throw error for empty array', async () => {
      await expect(service.generateBatchEmbeddings([])).rejects.toThrow(
        'Texts array cannot be empty'
      )
    })

    it('should throw error when all texts are invalid', async () => {
      await expect(service.generateBatchEmbeddings(['', '  ', '\n'])).rejects.toThrow(
        'No valid texts to embed'
      )
    })
  })

  describe('generateQueryEmbedding', () => {
    it('should generate embedding for query', async () => {
      const embedding = await service.generateQueryEmbedding('What is AI?')

      expect(embedding).toBeDefined()
      expect(embedding).toHaveLength(1536)
    })
  })

  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [1, 0, 0]

      const similarity = service.cosineSimilarity(vec1, vec2)

      expect(similarity).toBeCloseTo(1.0, 5)
    })

    it('should return 0 for perpendicular vectors', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [0, 1, 0]

      const similarity = service.cosineSimilarity(vec1, vec2)

      expect(similarity).toBeCloseTo(0.0, 5)
    })

    it('should handle negative similarity', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [-1, 0, 0]

      const similarity = service.cosineSimilarity(vec1, vec2)

      expect(similarity).toBeCloseTo(-1.0, 5)
    })

    it('should throw error for different length vectors', () => {
      const vec1 = [1, 0, 0]
      const vec2 = [1, 0]

      expect(() => service.cosineSimilarity(vec1, vec2)).toThrow(
        'Embeddings must have the same length'
      )
    })
  })

  describe('getModelDimension', () => {
    it('should return correct dimension for text-embedding-3-small', () => {
      const dimension = service.getModelDimension('text-embedding-3-small')
      expect(dimension).toBe(1536)
    })

    it('should return correct dimension for text-embedding-3-large', () => {
      const dimension = service.getModelDimension('text-embedding-3-large')
      expect(dimension).toBe(3072)
    })

    it('should return correct dimension for text-embedding-ada-002', () => {
      const dimension = service.getModelDimension('text-embedding-ada-002')
      expect(dimension).toBe(1536)
    })
  })
})
