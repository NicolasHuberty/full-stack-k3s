/**
 * Web Lawyer API Endpoint
 *
 * POST /api/web-lawyer
 *
 * Executes the Belgian Law Web Lawyer agent with:
 * - Qdrant RAG search
 * - JUPORTAL web search
 * - Full tool call logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeWebLawyer, streamWebLawyer } from '@/lib/agents/web-lawyer'

export const maxDuration = 120 // 2 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      query,
      sessionId,
      collectionId,
      useJuportal = true,
      useRag = true,
      topK = 10,
      language = 'FR',
      courts,
      stream = false,
    } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    console.log('[API:web-lawyer] Request:', {
      userId: session.user.id,
      query: query.slice(0, 100),
      useJuportal,
      useRag,
      topK,
      stream,
    })

    // Streaming response
    if (stream) {
      const encoder = new TextEncoder()

      const readable = new ReadableStream({
        async start(controller) {
          try {
            const generator = streamWebLawyer({
              query,
              sessionId,
              collectionId,
              useJuportal,
              useRag,
              topK,
              language,
              courts,
            })

            for await (const event of generator) {
              const data = `data: ${JSON.stringify(event)}\n\n`
              controller.enqueue(encoder.encode(data))
            }

            controller.close()
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : 'Unknown error'
            const errorEvent = `data: ${JSON.stringify({
              type: 'error',
              data: { error: errorMessage },
            })}\n\n`
            controller.enqueue(encoder.encode(errorEvent))
            controller.close()
          }
        },
      })

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // Non-streaming response
    const result = await executeWebLawyer({
      query,
      sessionId,
      collectionId,
      useJuportal,
      useRag,
      topK,
      language,
      courts,
    })

    console.log('[API:web-lawyer] Response:', {
      sessionId: result.sessionId.slice(0, 8),
      documentCount: result.documents.length,
      toolCallCount: result.toolCalls.length,
      answerLength: result.answer.length,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[API:web-lawyer] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}

// GET endpoint for tool definitions
export async function GET() {
  const { getWebLawyerTools } = await import('@/lib/agents/web-lawyer')
  const tools = getWebLawyerTools()

  return NextResponse.json({
    name: 'Web Lawyer (Belgian Law)',
    description:
      'Expert en droit belge utilisant la jurisprudence JUPORTAL et le RAG vectoriel',
    tools,
    features: [
      'Recherche sémantique dans Qdrant',
      'Recherche web sur JUPORTAL',
      'Citations ECLI automatiques',
      'Analyse juridique par GPT-4o',
      'Logs des appels outils visibles',
    ],
  })
}
