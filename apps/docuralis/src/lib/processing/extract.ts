/* eslint-disable @typescript-eslint/no-explicit-any */
import mammoth from 'mammoth'
import PDFParser from 'pdf2json'
import { OfficeParser } from 'officeparser'
import { isScannedPDF, performPDFOCR, performImageOCR } from './ocr'
import { logger } from '@/lib/logger'

export interface ExtractionResult {
  text: string
  isScanned?: boolean
  metadata?: {
    pageCount?: number
    wordCount?: number
    author?: string
    title?: string
  }
}

export class TextExtractor {
  /**
   * Extract text from a PDF file using pdf2json, with OCR fallback for scanned PDFs
   */
  async extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
    try {
      // First, check if this is a scanned PDF
      const isScanned = await isScannedPDF(buffer)

      if (isScanned) {
        logger.info('Detected scanned PDF, using OCR')
        const pageTexts = await performPDFOCR(buffer)

        const fullText = pageTexts.map((pt) => pt.text).join('\n\n')

        return {
          text: fullText,
          isScanned: true,
          metadata: {
            pageCount: pageTexts.length,
            wordCount: this.countWords(fullText),
          },
        }
      }

      // Normal PDF extraction
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
                } catch {
                  // If decoding fails, use the raw text
                  decodingErrors++
                  const rawText = text.R?.[0]?.T || ''
                  fullText += rawText + ' '
                }
              })
              fullText += '\n'
            })

            if (decodingErrors > 0) {
              logger.warn(
                `PDF extraction had ${decodingErrors} URI decoding errors, used raw text`
              )
            }

            const trimmedText = fullText.trim()

            // Check if extraction was successful - if not, try OCR
            if (!trimmedText || trimmedText.length < 50) {
              logger.warn('PDF extraction resulted in minimal text, trying OCR')

              // Try OCR as fallback
              performPDFOCR(buffer)
                .then((pageTexts) => {
                  const ocrText = pageTexts.map((pt) => pt.text).join('\n\n')

                  if (ocrText && ocrText.length > trimmedText.length) {
                    logger.info(
                      'OCR produced better results than PDF extraction'
                    )
                    resolve({
                      text: ocrText,
                      isScanned: true,
                      metadata: {
                        pageCount: pageTexts.length,
                        wordCount: this.countWords(ocrText),
                      },
                    })
                  } else {
                    // Use whatever we got from pdf2json
                    const meta = pdfData.Meta || {}
                    resolve({
                      text: trimmedText,
                      isScanned: false,
                      metadata: {
                        pageCount: pages.length,
                        wordCount: this.countWords(trimmedText),
                        author: meta.Author,
                        title: meta.Title,
                      },
                    })
                  }
                })
                .catch(() => {
                  // If OCR fails, just use the pdf2json result
                  const meta = pdfData.Meta || {}
                  resolve({
                    text: trimmedText,
                    isScanned: false,
                    metadata: {
                      pageCount: pages.length,
                      wordCount: this.countWords(trimmedText),
                      author: meta.Author,
                      title: meta.Title,
                    },
                  })
                })
              return
            }

            logger.info(
              `Extracted ${trimmedText.length} characters from ${pages.length} pages`
            )

            // Get metadata
            const meta = pdfData.Meta || {}

            resolve({
              text: trimmedText,
              isScanned: false,
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
      logger.error('Failed to extract text from PDF', error)
      throw new Error(
        `PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
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
      throw new Error(
        `DOCX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
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
      throw new Error(
        `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
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
      logger.error('Failed to extract text from Markdown', error)
      throw new Error(
        `Markdown extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Extract text from an image file using OCR
   */
  async extractFromImage(buffer: Buffer): Promise<ExtractionResult> {
    try {
      logger.info('Extracting text from image using OCR')
      const pageText = await performImageOCR(buffer)

      return {
        text: pageText.text,
        isScanned: true,
        metadata: {
          pageCount: 1,
          wordCount: this.countWords(pageText.text),
        },
      }
    } catch (error) {
      logger.error('Failed to extract text from image', error)
      throw new Error(
        `Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Extract text from a PowerPoint file (PPTX)
   */
  async extractFromPPTX(buffer: Buffer): Promise<ExtractionResult> {
    try {
      logger.info('Extracting text from PPTX')
      const ast = await OfficeParser.parseOffice(buffer)
      const text = ast.toText()

      return {
        text: text || '',
        metadata: {
          wordCount: this.countWords(text || ''),
        },
      }
    } catch (error) {
      logger.error('Failed to extract text from PPTX', error)
      throw new Error(
        `PPTX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Extract text from an Excel file (XLSX)
   */
  async extractFromXLSX(buffer: Buffer): Promise<ExtractionResult> {
    try {
      logger.info('Extracting text from XLSX')
      const ast = await OfficeParser.parseOffice(buffer)
      const text = ast.toText()

      return {
        text: text || '',
        metadata: {
          wordCount: this.countWords(text || ''),
        },
      }
    } catch (error) {
      logger.error('Failed to extract text from XLSX', error)
      throw new Error(
        `XLSX extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Main extraction method that routes to the appropriate extractor
   */
  async extractText(
    buffer: Buffer,
    mimeType: string
  ): Promise<ExtractionResult> {
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

        case 'image/png':
        case 'image/jpeg':
        case 'image/jpg':
        case 'image/tiff':
        case 'image/bmp':
          return await this.extractFromImage(buffer)

        case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        case 'application/vnd.ms-powerpoint':
          return await this.extractFromPPTX(buffer)

        case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        case 'application/vnd.ms-excel':
          return await this.extractFromXLSX(buffer)

        default:
          // Try to extract as plain text for unknown types
          try {
            return await this.extractFromText(buffer)
          } catch {
            throw new Error(`Unsupported file type: ${mimeType}`)
          }
      }
    } catch (error) {
      logger.error('Text extraction failed', error)
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
   * Clean extracted text (remove excessive whitespace, null bytes, etc.)
   */
  cleanText(text: string): string {
    return text
      .replace(/\x00/g, '') // Remove null bytes (causes PostgreSQL UTF-8 errors)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters
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
