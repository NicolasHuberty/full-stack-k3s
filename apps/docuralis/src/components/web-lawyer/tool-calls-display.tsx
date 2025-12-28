/**
 * Tool Calls Display Component
 *
 * Displays tool call status and results for the Web Lawyer agent.
 * Shows tool name, status, duration, and results summary.
 */

'use client'

import { cn } from '@/lib/utils'
import type { ToolCallDisplay } from '@/hooks/use-web-lawyer'
import {
  Loader2,
  Check,
  AlertCircle,
  Search,
  Database,
  Clock,
  ExternalLink,
} from 'lucide-react'

interface ToolCallsDisplayProps {
  toolCalls: ToolCallDisplay[]
  className?: string
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  search_juportal: <ExternalLink className="h-4 w-4" />,
  search_jurisprudence_rag: <Database className="h-4 w-4" />,
  search_collection_jurisprudence: <Search className="h-4 w-4" />,
}

const TOOL_LABELS: Record<string, string> = {
  search_juportal: 'JUPORTAL Web Search',
  search_jurisprudence_rag: 'Qdrant RAG Search',
  search_collection_jurisprudence: 'Collection Search',
}

export function ToolCallsDisplay({
  toolCalls,
  className,
}: ToolCallsDisplayProps) {
  if (toolCalls.length === 0) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Search className="h-4 w-4" />
        Tool Calls
      </h4>
      <div className="space-y-2">
        {toolCalls.map((call) => (
          <ToolCallItem key={call.id} call={call} />
        ))}
      </div>
    </div>
  )
}

function ToolCallItem({ call }: { call: ToolCallDisplay }) {
  const icon = TOOL_ICONS[call.name] || <Search className="h-4 w-4" />
  const label = TOOL_LABELS[call.name] || call.name

  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm transition-colors',
        call.status === 'running' && 'border-blue-200 bg-blue-50',
        call.status === 'completed' && 'border-green-200 bg-green-50',
        call.status === 'error' && 'border-red-200 bg-red-50',
        call.status === 'pending' && 'border-gray-200 bg-gray-50'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Status Icon */}
          {call.status === 'running' && (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          )}
          {call.status === 'completed' && (
            <Check className="h-4 w-4 text-green-500" />
          )}
          {call.status === 'error' && (
            <AlertCircle className="h-4 w-4 text-red-500" />
          )}
          {call.status === 'pending' && (
            <Clock className="h-4 w-4 text-gray-400" />
          )}

          {/* Tool Icon & Label */}
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium">{label}</span>
        </div>

        {/* Duration */}
        <span
          className={cn(
            'text-xs',
            call.status === 'running'
              ? 'text-blue-600'
              : 'text-muted-foreground'
          )}
        >
          {call.duration}
        </span>
      </div>

      {/* Result Summary */}
      {call.resultSummary && (
        <div className="mt-1 text-xs text-muted-foreground">
          {call.resultSummary}
        </div>
      )}

      {/* Error */}
      {call.error && (
        <div className="mt-1 text-xs text-red-600">{call.error}</div>
      )}

      {/* Args Preview (collapsed) */}
      {Object.keys(call.args).length > 0 && (
        <details className="mt-2">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            View arguments
          </summary>
          <pre className="mt-1 text-xs bg-muted/50 p-2 rounded overflow-x-auto">
            {JSON.stringify(call.args, null, 2)}
          </pre>
        </details>
      )}
    </div>
  )
}

/**
 * Compact version for inline display
 */
export function ToolCallsInline({
  toolCalls,
  className,
}: ToolCallsDisplayProps) {
  if (toolCalls.length === 0) {
    return null
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {toolCalls.map((call) => {
        const icon = TOOL_ICONS[call.name] || <Search className="h-3 w-3" />
        const label = TOOL_LABELS[call.name] || call.name

        return (
          <div
            key={call.id}
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
              call.status === 'running' &&
                'bg-blue-100 text-blue-700 animate-pulse',
              call.status === 'completed' && 'bg-green-100 text-green-700',
              call.status === 'error' && 'bg-red-100 text-red-700',
              call.status === 'pending' && 'bg-gray-100 text-gray-600'
            )}
          >
            {call.status === 'running' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : call.status === 'completed' ? (
              <Check className="h-3 w-3" />
            ) : call.status === 'error' ? (
              <AlertCircle className="h-3 w-3" />
            ) : (
              icon
            )}
            <span>{label}</span>
            {call.status !== 'running' && (
              <span className="text-[10px] opacity-70">{call.duration}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
