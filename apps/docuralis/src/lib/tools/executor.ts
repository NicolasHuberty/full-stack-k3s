/**
 * Tool Executor - MCP-style Tool Execution with Logging
 *
 * Provides a unified interface for executing tools with:
 * - Full logging of tool calls
 * - Tool call tracking for frontend visibility
 * - Event emission for real-time updates
 */

import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'
import {
  ToolCall,
  ToolDefinition,
  ToolResult,
  ToolStatus,
  JurisprudenceSearchResult,
} from './types'
import { juportalSearchToolDefinition, executeJuportalSearch } from './juportal'
import {
  jurisprudenceRagToolDefinition,
  executeJurisprudenceRagSearch,
  searchCollectionJurisprudence,
} from './jurisprudence-rag'

// Event emitter for tool call notifications
export const toolEvents = new EventEmitter()

// Tool call history (in-memory, for session tracking)
const toolCallHistory: Map<string, ToolCall[]> = new Map()

/**
 * Available tools registry
 */
export const AVAILABLE_TOOLS: Record<string, ToolDefinition> = {
  search_juportal: juportalSearchToolDefinition,
  search_jurisprudence_rag: jurisprudenceRagToolDefinition,
}

/**
 * Log a tool call event
 */
function logToolCall(
  sessionId: string,
  toolCall: ToolCall,
  event: 'start' | 'complete' | 'error'
): void {
  const prefix = `[TOOL:${toolCall.name}]`
  const callId = toolCall.id.slice(0, 8)

  switch (event) {
    case 'start':
      console.log(`${prefix} [${callId}] Starting execution...`)
      console.log(
        `${prefix} [${callId}] Args:`,
        JSON.stringify(toolCall.args, null, 2)
      )
      break
    case 'complete':
      console.log(`${prefix} [${callId}] Completed in ${toolCall.durationMs}ms`)
      if (toolCall.result) {
        const result = toolCall.result as ToolResult
        console.log(
          `${prefix} [${callId}] Success: ${result.success}, Items: ${result.metadata?.itemCount || 0}`
        )
      }
      break
    case 'error':
      console.error(`${prefix} [${callId}] Error: ${toolCall.error}`)
      break
  }

  // Emit event for real-time tracking
  toolEvents.emit('toolCall', { sessionId, toolCall, event })
}

/**
 * Execute a tool by name with given arguments
 */
export async function executeTool(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Create tool call record
  const toolCall: ToolCall = {
    id: uuidv4(),
    name: toolName,
    args,
    status: 'pending' as ToolStatus,
    startedAt: new Date(),
  }

  // Store in history
  if (!toolCallHistory.has(sessionId)) {
    toolCallHistory.set(sessionId, [])
  }
  toolCallHistory.get(sessionId)!.push(toolCall)

  // Update status and log
  toolCall.status = 'running'
  logToolCall(sessionId, toolCall, 'start')

  try {
    let result: ToolResult

    // Route to appropriate tool executor
    switch (toolName) {
      case 'search_juportal':
        result = await executeJuportalSearch({
          query: args.query as string,
          courts: args.courts as string[] | undefined,
          dateFrom: args.dateFrom as string | undefined,
          dateTo: args.dateTo as string | undefined,
          languages: args.languages as string[] | undefined,
          limit: args.limit as number | undefined,
        })
        break

      case 'search_jurisprudence_rag':
        result = await executeJurisprudenceRagSearch({
          query: args.query as string,
          courtCodes: args.courtCodes as string[] | undefined,
          topK: args.topK as number | undefined,
          minScore: args.minScore as number | undefined,
          language: args.language as string | undefined,
        })
        break

      case 'search_collection_jurisprudence':
        result = await searchCollectionJurisprudence(
          args.collectionId as string,
          args.query as string,
          args.topK as number | undefined
        )
        break

      default:
        throw new Error(`Unknown tool: ${toolName}`)
    }

    // Update tool call record
    toolCall.status = 'completed'
    toolCall.completedAt = new Date()
    toolCall.durationMs =
      toolCall.completedAt.getTime() - toolCall.startedAt.getTime()
    toolCall.result = result

    logToolCall(sessionId, toolCall, 'complete')

    return result
  } catch (error) {
    // Update tool call record with error
    toolCall.status = 'error'
    toolCall.completedAt = new Date()
    toolCall.durationMs =
      toolCall.completedAt.getTime() - toolCall.startedAt.getTime()
    toolCall.error = error instanceof Error ? error.message : 'Unknown error'

    logToolCall(sessionId, toolCall, 'error')

    return {
      success: false,
      error: toolCall.error,
      metadata: {
        durationMs: toolCall.durationMs,
        source: toolName,
      },
    }
  }
}

/**
 * Execute multiple tools in parallel
 */
export async function executeToolsParallel(
  sessionId: string,
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>
): Promise<ToolResult[]> {
  console.log(`[TOOL-EXECUTOR] Executing ${toolCalls.length} tools in parallel`)

  const promises = toolCalls.map((tc) =>
    executeTool(sessionId, tc.name, tc.args)
  )

  return Promise.all(promises)
}

/**
 * Get tool call history for a session
 */
export function getToolCallHistory(sessionId: string): ToolCall[] {
  return toolCallHistory.get(sessionId) || []
}

/**
 * Clear tool call history for a session
 */
export function clearToolCallHistory(sessionId: string): void {
  toolCallHistory.delete(sessionId)
}

/**
 * Get all available tool definitions
 */
export function getToolDefinitions(): ToolDefinition[] {
  return Object.values(AVAILABLE_TOOLS)
}

/**
 * Format tool calls for frontend display
 */
export function formatToolCallsForDisplay(sessionId: string): Array<{
  id: string
  name: string
  status: ToolStatus
  duration: string
  args: Record<string, unknown>
  resultSummary?: string
  error?: string
}> {
  const history = getToolCallHistory(sessionId)

  return history.map((tc) => {
    let resultSummary: string | undefined

    if (tc.result) {
      const result = tc.result as ToolResult<JurisprudenceSearchResult>
      if (result.success && result.data) {
        resultSummary = `Found ${result.data.totalCount} results from ${result.data.source}`
      }
    }

    return {
      id: tc.id,
      name: tc.name,
      status: tc.status,
      duration: tc.durationMs ? `${tc.durationMs}ms` : 'running...',
      args: tc.args,
      resultSummary,
      error: tc.error,
    }
  })
}

/**
 * Subscribe to tool call events
 */
export function onToolCall(
  callback: (data: {
    sessionId: string
    toolCall: ToolCall
    event: 'start' | 'complete' | 'error'
  }) => void
): () => void {
  toolEvents.on('toolCall', callback)
  return () => toolEvents.off('toolCall', callback)
}
