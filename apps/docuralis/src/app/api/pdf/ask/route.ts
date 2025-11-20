import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ChatOpenAI } from '@langchain/openai'
import PDFParser from 'pdf2json'

export const maxDuration = 60

const askSchema = z.object({
  documentId: z.string(),
  documentName: z.string(),
  collectionId: z.string().optional(),
  selectedText: z.string(),
  question: z.string(),
  currentPage: z.number(),
  pdfData: z.string(), // Base64 encoded PDF data
})

/**
 * Extract text from the first N pages of a PDF
 */
async function extractFirstPages(
  pdfBuffer: Buffer,
  numPages: number = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const pdfParser = new (PDFParser as unknown as new (arg1: null, arg2: boolean) => {
      on: <T>(event: string, handler: (data: T) => void) => void;
      parseBuffer: (buffer: Buffer) => void;
    })(null, true)

    pdfParser.on<{ parserError?: string }>('pdfParser_dataError', (errData) => {
      reject(new Error(`PDF parsing error: ${errData.parserError}`))
    })

    pdfParser.on<{ Pages?: Array<{ Texts?: Array<{ R?: Array<{ T?: string }> }> }> }>('pdfParser_dataReady', (pdfData) => {
      try {
        let extractedText = ''
        const pages = pdfData.Pages || []
        const pagesToExtract = Math.min(numPages, pages.length)

        for (let i = 0; i < pagesToExtract; i++) {
          const page = pages[i]
          const texts = page.Texts || []

          extractedText += `\n--- Page ${i + 1} ---\n`

          texts.forEach((text: { R?: Array<{ T?: string }> }) => {
            try {
              const encoded = text.R?.[0]?.T || ''
              if (encoded) {
                const decoded = decodeURIComponent(encoded)
                extractedText += decoded + ' '
              }
            } catch {
              const rawText = text.R?.[0]?.T || ''
              extractedText += rawText + ' '
            }
          })
          extractedText += '\n'
        }

        resolve(extractedText.trim())
      } catch (error) {
        reject(error)
      }
    })

    pdfParser.parseBuffer(pdfBuffer)
  })
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = askSchema.parse(body)

    // Get document metadata from database
    let document:
      | {
          originalName: string
          title: string | null
          author: string | null
          pageCount: number | null
          wordCount: number | null
          filename?: string
          collectionId?: string
        }
      | null = null

    // Check if it's a migrated document
    if (validatedData.documentId.startsWith('migrated_')) {
      // For migrated documents, we don't have DB records, so we'll create a minimal metadata object
      document = {
        originalName: validatedData.documentName,
        title: validatedData.documentName,
        author: null,
        pageCount: null,
        wordCount: null,
      }
    } else {
      // Get document from database
      document = await prisma.document.findUnique({
        where: { id: validatedData.documentId },
        select: {
          originalName: true,
          title: true,
          author: true,
          pageCount: true,
          wordCount: true,
          filename: true,
          collectionId: true,
        },
      })

      if (!document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }
    }

    // Decode PDF data from base64
    const pdfBuffer = Buffer.from(validatedData.pdfData, 'base64')

    // Extract first 2 pages for context
    let firstPagesText = ''
    try {
      firstPagesText = await extractFirstPages(pdfBuffer, 2)
    } catch (error) {
      console.error('Error extracting first pages:', error)
      // Continue without first pages context if extraction fails
      firstPagesText = '[Unable to extract first pages]'
    }

    // Build context for the AI
    const metadataContext = `
Document Metadata:
- Title: ${document.title || document.originalName}
- Author: ${document.author || 'Unknown'}
- Total Pages: ${document.pageCount || 'Unknown'}
- Word Count: ${document.wordCount || 'Unknown'}
- Current Page: ${validatedData.currentPage}

First 2 Pages (for reference):
${firstPagesText}

Selected Text (from page ${validatedData.currentPage}):
"${validatedData.selectedText}"
`.trim()

    // Call OpenAI API using LangChain (same as the rest of the app)
    const model = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      maxTokens: 1024,
    })

    const response = await model.invoke([
      {
        role: 'system',
        content:
          'You are a helpful AI assistant analyzing a PDF document. You have access to the document\'s metadata, the first 2 pages for context, and a specific text selection the user made.',
      },
      {
        role: 'user',
        content: `${metadataContext}

User's question about the selected text:
${validatedData.question}

Please provide a clear, concise answer based on the selected text and the available context. If you need to reference information from the first pages or metadata, please do so.`,
      },
    ])

    // Extract the answer from the response
    const answer = response.content.toString()

    return NextResponse.json({
      answer,
      metadata: {
        documentTitle: document.title || document.originalName,
        currentPage: validatedData.currentPage,
        selectedTextLength: validatedData.selectedText.length,
      },
    })
  } catch (error) {
    console.error('Error in PDF ask API:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to process question' },
      { status: 500 }
    )
  }
}
