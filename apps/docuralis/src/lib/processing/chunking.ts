// Import tiktoken lazily to avoid WASM issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let encoding_for_model: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const tiktoken = require('tiktoken')
  encoding_for_model = tiktoken.encoding_for_model
} catch {
  console.warn('Tiktoken not available, will use fallback token counting')
}

export interface TextChunk {
  content: string
  index: number
  startChar: number
  endChar: number
  tokenCount?: number
}

export interface ChunkingOptions {
  chunkSize: number // in characters
  chunkOverlap: number // in characters
  respectSentences?: boolean // try to break at sentence boundaries
}

export class ChunkingService {
  /**
   * Split text into overlapping chunks
   */
  chunkText(text: string, options: ChunkingOptions): TextChunk[] {
    const { chunkSize, chunkOverlap, respectSentences = true } = options

    if (chunkSize <= 0) {
      throw new Error('Chunk size must be greater than 0')
    }

    if (chunkOverlap >= chunkSize) {
      throw new Error('Chunk overlap must be less than chunk size')
    }

    if (!text || text.trim().length === 0) {
      return []
    }

    const chunks: TextChunk[] = []
    let startChar = 0
    let index = 0

    while (startChar < text.length) {
      let endChar = Math.min(startChar + chunkSize, text.length)

      // If we're respecting sentences and not at the end of the text,
      // try to find a sentence boundary
      if (respectSentences && endChar < text.length) {
        endChar = this.findSentenceBoundary(text, startChar, endChar)
      }

      const content = text.substring(startChar, endChar).trim()

      if (content.length > 0) {
        chunks.push({
          content,
          index,
          startChar,
          endChar,
        })
        index++
      }

      // Move start position forward by (chunkSize - overlap)
      startChar += chunkSize - chunkOverlap

      // Ensure we make progress
      if (startChar <= chunks[chunks.length - 1]?.startChar) {
        startChar = chunks[chunks.length - 1].startChar + chunkSize
      }
    }

    return chunks
  }

  /**
   * Find the nearest sentence boundary before the target position
   */
  private findSentenceBoundary(text: string, start: number, target: number): number {
    // Look for sentence-ending punctuation followed by whitespace
    const sentenceEnders = ['. ', '! ', '? ', '.\n', '!\n', '?\n']

    // Search backwards from target position
    let bestBoundary = target
    let minDistance = Infinity

    for (let i = target; i > start && i > target - 200; i--) {
      for (const ender of sentenceEnders) {
        if (text.substring(i, i + ender.length) === ender) {
          const distance = target - i
          if (distance < minDistance) {
            minDistance = distance
            bestBoundary = i + ender.length
          }
        }
      }
    }

    // If we found a good boundary within 200 chars, use it
    if (minDistance < 200) {
      return bestBoundary
    }

    // Otherwise, look for any whitespace
    for (let i = target; i > start && i > target - 100; i--) {
      if (/\s/.test(text[i])) {
        return i + 1
      }
    }

    // If no good boundary found, just use the target
    return target
  }

  /**
   * Count tokens in text using tiktoken (with fallback)
   */
  async countTokens(text: string, model: string = 'gpt-3.5-turbo'): Promise<number> {
    try {
      if (!encoding_for_model) {
        // Tiktoken not available, use fallback
        return Math.ceil(text.length / 4)
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const encoder = encoding_for_model(model as any)
      const tokens = encoder.encode(text)
      const count = tokens.length
      encoder.free()
      return count
    } catch (error) {
      // Fallback to rough estimation if tiktoken fails
      // Roughly 4 characters per token for English text
      return Math.ceil(text.length / 4)
    }
  }

  /**
   * Add token counts to chunks
   */
  async addTokenCounts(chunks: TextChunk[], model: string = 'gpt-3.5-turbo'): Promise<TextChunk[]> {
    const chunksWithTokens = await Promise.all(
      chunks.map(async (chunk) => ({
        ...chunk,
        tokenCount: await this.countTokens(chunk.content, model),
      }))
    )
    return chunksWithTokens
  }

  /**
   * Chunk text by semantic sections (paragraphs, headings, etc.)
   */
  chunkBySections(text: string, maxChunkSize: number = 1000): TextChunk[] {
    const sections = this.splitIntoSections(text)
    const chunks: TextChunk[] = []
    let currentChunk = ''
    let currentStartChar = 0
    let index = 0

    for (const section of sections) {
      // If adding this section would exceed maxChunkSize and we have content
      if (currentChunk.length > 0 && currentChunk.length + section.length > maxChunkSize) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          index,
          startChar: currentStartChar,
          endChar: currentStartChar + currentChunk.length,
        })
        index++
        currentChunk = ''
        currentStartChar += currentChunk.length
      }

      // If a single section is larger than maxChunkSize, split it
      if (section.length > maxChunkSize) {
        const subChunks = this.chunkText(section, {
          chunkSize: maxChunkSize,
          chunkOverlap: 100,
          respectSentences: true,
        })

        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            index,
            startChar: currentStartChar + subChunk.startChar,
            endChar: currentStartChar + subChunk.endChar,
          })
          index++
        }
        currentStartChar += section.length
      } else {
        currentChunk += section + '\n\n'
      }
    }

    // Add any remaining content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        content: currentChunk.trim(),
        index,
        startChar: currentStartChar,
        endChar: currentStartChar + currentChunk.length,
      })
    }

    return chunks
  }

  /**
   * Split text into sections (paragraphs)
   */
  private splitIntoSections(text: string): string[] {
    // Split by double newlines (paragraphs)
    return text
      .split(/\n\n+/)
      .map((section) => section.trim())
      .filter((section) => section.length > 0)
  }
}

// Singleton instance
let chunkingService: ChunkingService | null = null

export function getChunkingService(): ChunkingService {
  if (!chunkingService) {
    chunkingService = new ChunkingService()
  }
  return chunkingService
}
