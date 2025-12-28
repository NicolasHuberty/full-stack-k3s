/**
 * Test API endpoint for Belgian Law Agent
 *
 * POST /api/test-belgian-law
 * Body: { query: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getBelgianLawAgentService } from '@/lib/agents/belgian-law-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, collectionId } = body

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    console.log('[TEST-BELGIAN-LAW] Starting test with query:', query)
    console.log('[TEST-BELGIAN-LAW] Collection ID:', collectionId || 'none')

    const service = getBelgianLawAgentService()

    const result = await service.executeAgent(
      query,
      'test-user',
      {
        collectionId,
        maxIterations: 15, // Increased for comprehensive multi-angle search
      },
      (event) => {
        console.log('[TEST-BELGIAN-LAW] Progress:', event.type, event.data)
      }
    )

    return NextResponse.json({
      success: true,
      answer: result.answer,
      sources: result.sources,
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      },
    })
  } catch (error) {
    console.error('[TEST-BELGIAN-LAW] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Belgian Law Agent Test Endpoint',
    usage: 'POST with { "query": "your legal question" }',
    example: {
      query: 'Quelle est la compétence du juge de paix en matière de bail?',
    },
  })
}
