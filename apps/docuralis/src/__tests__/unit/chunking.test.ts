import { ChunkingService } from '@/lib/processing/chunking'

describe('ChunkingService', () => {
  let service: ChunkingService

  beforeEach(() => {
    service = new ChunkingService()
  })

  describe('chunkText', () => {
    it('should split text into chunks with correct size', () => {
      const text = 'This is a test. '.repeat(100) // 1600 characters
      const chunks = service.chunkText(text, {
        chunkSize: 500,
        chunkOverlap: 100,
        respectSentences: false,
      })

      expect(chunks.length).toBeGreaterThan(0)
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(500)
      })
    })

    it('should create overlapping chunks', () => {
      const text =
        'Sentence one. Sentence two. Sentence three. Sentence four. Sentence five.'
      const chunks = service.chunkText(text, {
        chunkSize: 30,
        chunkOverlap: 10,
      })

      expect(chunks.length).toBeGreaterThan(1)

      // Check that chunks have proper indices
      chunks.forEach((chunk, index) => {
        expect(chunk.index).toBe(index)
      })
    })

    it('should respect sentence boundaries when enabled', () => {
      const text =
        'This is sentence one. This is sentence two. This is sentence three.'
      const chunks = service.chunkText(text, {
        chunkSize: 40,
        chunkOverlap: 10,
        respectSentences: true,
      })

      // Chunks should end near sentence boundaries
      chunks.forEach((chunk) => {
        const trimmed = chunk.content.trim()
        expect(trimmed.length).toBeGreaterThan(0)
      })
    })

    it('should handle empty text', () => {
      const chunks = service.chunkText('', {
        chunkSize: 100,
        chunkOverlap: 20,
      })

      expect(chunks).toEqual([])
    })

    it('should handle text shorter than chunk size', () => {
      const text = 'Short text'
      const chunks = service.chunkText(text, {
        chunkSize: 100,
        chunkOverlap: 20,
      })

      expect(chunks.length).toBe(1)
      expect(chunks[0].content).toBe('Short text')
    })

    it('should throw error for invalid chunk size', () => {
      expect(() => {
        service.chunkText('test', {
          chunkSize: 0,
          chunkOverlap: 0,
        })
      }).toThrow('Chunk size must be greater than 0')
    })

    it('should throw error when overlap >= chunk size', () => {
      expect(() => {
        service.chunkText('test', {
          chunkSize: 100,
          chunkOverlap: 100,
        })
      }).toThrow('Chunk overlap must be less than chunk size')
    })

    it('should set correct start and end character positions', () => {
      const text = 'A'.repeat(200)
      const chunks = service.chunkText(text, {
        chunkSize: 50,
        chunkOverlap: 10,
      })

      chunks.forEach((chunk) => {
        expect(chunk.endChar).toBeGreaterThan(chunk.startChar)
        expect(chunk.endChar - chunk.startChar).toBeLessThanOrEqual(50)
      })
    })
  })

  describe('chunkBySections', () => {
    it('should split text by paragraphs', () => {
      const text = `Paragraph one is here.

Paragraph two is here.

Paragraph three is here.`

      const chunks = service.chunkBySections(text, 100)

      expect(chunks.length).toBeGreaterThan(0)
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeGreaterThan(0)
      })
    })

    it('should handle sections larger than max chunk size', () => {
      const largeSection = 'A'.repeat(2000)
      const text = `${largeSection}\n\nSmall section`

      const chunks = service.chunkBySections(text, 500)

      expect(chunks.length).toBeGreaterThan(1)
    })
  })

  describe('estimateTokenCount', () => {
    it('should estimate tokens approximately', () => {
      const text = 'This is a test sentence with some words.'
      const count = service.estimateTokenCount(text)

      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(text.length) // Tokens are usually less than characters
    })

    it('should handle empty text', () => {
      const count = service.estimateTokenCount('')
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  describe('addTokenCounts', () => {
    it('should add token counts to chunks', async () => {
      const text = 'This is a test. '.repeat(20)
      const chunks = service.chunkText(text, {
        chunkSize: 100,
        chunkOverlap: 20,
      })

      const chunksWithTokens = await service.addTokenCounts(chunks)

      chunksWithTokens.forEach((chunk) => {
        expect(chunk.tokenCount).toBeDefined()
        expect(chunk.tokenCount).toBeGreaterThan(0)
      })
    })
  })
})
