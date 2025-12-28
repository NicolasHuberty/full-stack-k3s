/**
 * Web Lawyer Tools API Endpoint
 *
 * GET /api/web-lawyer/tools - Get available tool definitions
 * GET /api/web-lawyer/tools?sessionId=xxx - Get tool call history for a session
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getToolDefinitions,
  getToolCallHistory,
  formatToolCallsForDisplay,
  getAvailableCourts,
} from '@/lib/tools'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    // If sessionId provided, return tool call history
    if (sessionId) {
      const history = formatToolCallsForDisplay(sessionId)
      return NextResponse.json({
        sessionId,
        toolCalls: history,
        count: history.length,
      })
    }

    // Otherwise return tool definitions
    const tools = getToolDefinitions()
    const courts = getAvailableCourts()

    return NextResponse.json({
      tools,
      courts,
      metadata: {
        version: '1.0.0',
        description: 'Belgian Law jurisprudence search tools',
      },
    })
  } catch (error) {
    console.error('[API:web-lawyer/tools] Error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    )
  }
}
