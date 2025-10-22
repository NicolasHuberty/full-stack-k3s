import mammoth from 'mammoth'
import PDFParser from 'pdf2json'

export interface ExtractionResult {
  text: string
  metadata?: {
    pageCount?: number
    wordCount?: number
    author?: string
    title?: string
  }
}

export class TextExtractor {
  /**
   * Extract text from a PDF file using pdf2json
   */
  async extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
    try {
      return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(null, true)

        pdfParser.on('pdfParser_dataError', (errData: any) => {
          reject(new Error(`PDF parsing error: ${errData.parserError}`))
        })

        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          try {
            // Extract text from all pages
            let fullText = ''
            const pages = pdfData.Pages || []
            let decodingErrors = 0

            pages.forEach((page: any) => {
              const texts = page.Texts || []
              texts.forEach((text: any) => {
                try {
                  const encoded = text.R?.[0]?.T || ''
                  if (encoded) {
                    const decoded = decodeURIComponent(encoded)
                    fullText += decoded + ' '
                  }
                } catch (error) {
                  // If decoding fails, use the raw text
                  decodingErrors++
                  const rawText = text.R?.[0]?.T || ''
                  fullText += rawText + ' '
                }
              })
              fullText += '\n'
            })

            if (decodingErrors > 0) {
              console.warn(`PDF extraction had ${decodingErrors} URI decoding errors, used raw text`)
            }

            const trimmedText = fullText.trim()

            // Check if extraction was successful
            if (!trimmedText || trimmedText.length === 0) {
              console.warn('PDF extraction resulted in empty text')
            }

            console.log(`Extracted ${trimmedText.length} characters from ${pages.length} pages`)

            // Get metadata
            const meta = pdfData.Meta || {}

            resolve({
              text: trimmedText,
              metadata: {
                pageCount: pages.length,
                wordCount: this.countWords(trimmedText),
                author: meta.Author,
                title: meta.Title,
              },
            })
          } catch (err) {
            reject(err)
          }
        })

        pdfParser.parseBuffer(buffer)
      })
    } catch (error) {
      console.error('Failed to extract text from PDF:', error)
      throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from a DOCX file
   */
  async extractFromDOCX(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const result = await mammoth.extractRawText({ buffer })

      return {
        text: result.value,
        metadata: {
          wordCount: this.countWords(result.value),
        },
      }
    } catch (error) {
      console.error('Failed to extract text from DOCX:', error)
      throw new Error(`DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from a plain text file
   */
  async extractFromText(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const text = buffer.toString('utf-8')

      return {
        text,
        metadata: {
          wordCount: this.countWords(text),
        },
      }
    } catch (error) {
      console.error('Failed to extract text from TXT:', error)
      throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract text from a markdown file
   */
  async extractFromMarkdown(buffer: Buffer): Promise<ExtractionResult> {
    try {
      const text = buffer.toString('utf-8')

      return {
        text,
        metadata: {
          wordCount: this.countWords(text),
        },
      }
    } catch (error) {
      console.error('Failed to extract text from Markdown:', error)
      throw new Error(`Markdown extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Main extraction method that routes to the appropriate extractor
   */
  async extractText(buffer: Buffer, mimeType: string): Promise<ExtractionResult> {
    try {
      switch (mimeType) {
        case 'application/pdf':
          return await this.extractFromPDF(buffer)

        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        case 'application/msword':
          return await this.extractFromDOCX(buffer)

        case 'text/plain':
          return await this.extractFromText(buffer)

        case 'text/markdown':
        case 'text/x-markdown':
          return await this.extractFromMarkdown(buffer)

        default:
          // Try to extract as plain text for unknown types
          try {
            return await this.extractFromText(buffer)
          } catch (e) {
            throw new Error(`Unsupported file type: ${mimeType}`)
          }
      }
    } catch (error) {
      console.error('Text extraction failed:', error)
      throw error
    }
  }

  /**
   * Count words in a text
   */
  private countWords(text: string): number {
    const trimmed = text.trim()
    if (!trimmed) return 0

    const words = trimmed.split(/\s+/)
    return words.length
  }

  /**
   * Clean extracted text (remove excessive whitespace, etc.)
   */
  cleanText(text: string): string {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/[ \t]{2,}/g, ' ') // Remove excessive spaces
      .trim()
  }
}

// Singleton instance
let textExtractor: TextExtractor | null = null

export function getTextExtractor(): TextExtractor {
  if (!textExtractor) {
    textExtractor = new TextExtractor()
  }
  return textExtractor
}
