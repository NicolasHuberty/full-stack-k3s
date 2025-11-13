export interface TextChunk {
  content: string
  index: number
  startChar: number
  endChar: number
  tokenCount?: number
}

export interface ChunkingOptions {
  chunkSize: number // in characters or tokens
  chunkOverlap: number // in characters or tokens
  respectSentences?: boolean // try to break at sentence boundaries
  useTokens?: boolean // if true, chunkSize and chunkOverlap are in tokens
}

export class ChunkingService {
  /**
   * Split text into token-based chunks (matching Emate backend logic)
   * This splits by words (tokens) not characters
   */
  chunkTextByTokens(text: string, chunkSize: number = 500, chunkOverlap: number = 0): TextChunk[] {
    if (!text || text.trim().length === 0) {
      return []
    }

    // Split text into words (tokens)
    const tokens = text.split(/\s+/).filter(token => token.length > 0)
    const chunks: TextChunk[] = []
    let start = 0
    let index = 0
    let charOffset = 0

    while (start < tokens.length) {
      const end = Math.min(start + chunkSize, tokens.length)
      const chunkTokens = tokens.slice(start, end)
      const content = chunkTokens.join(' ')

      const startChar = charOffset
      const endChar = startChar + content.length

      chunks.push({
        content,
        index,
        startChar,
        endChar,
        tokenCount: chunkTokens.length,
      })

      index++
      charOffset = endChar + 1 // +1 for the space
      start += chunkSize - chunkOverlap
    }

    return chunks
  }

  /**
   * Split text into overlapping chunks
   */
  chunkText(text: string, options: ChunkingOptions): TextChunk[] {
    const { chunkSize, chunkOverlap, respectSentences = true, useTokens = false } = options

    // If useTokens is true, use the token-based chunking
    if (useTokens) {
      return this.chunkTextByTokens(text, chunkSize, chunkOverlap)
    }

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
  private findSentenceBoundary(
    text: string,
    start: number,
    target: number
  ): number {
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
   * Estimate token count using simple word-based approximation
   * OpenAI will return actual token count in API response
   */
  estimateTokenCount(text: string): number {
    // Simple word-based estimation: split by whitespace
    const words = text.split(/\s+/).filter(word => word.length > 0)
    return words.length
  }

  /**
   * Add estimated token counts to chunks
   * Actual token counts will come from OpenAI API response
   */
  addTokenCounts(chunks: TextChunk[]): TextChunk[] {
    return chunks.map((chunk) => ({
      ...chunk,
      tokenCount: this.estimateTokenCount(chunk.content),
    }))
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
      if (
        currentChunk.length > 0 &&
        currentChunk.length + section.length > maxChunkSize
      ) {
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
