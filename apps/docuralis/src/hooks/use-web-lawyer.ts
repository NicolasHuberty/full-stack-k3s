/**
 * Web Lawyer React Hook
 *
 * Provides a React hook for using the Web Lawyer agent with:
 * - Streaming responses
 * - Tool call visibility
 * - Loading states
 * - Error handling
 */

'use client'

import { useState, useCallback, useRef } from 'react'

// Types
export interface ToolCallDisplay {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  duration: string
  args: Record<string, unknown>
  resultSummary?: string
  error?: string
}

export interface JurisprudenceDocument {
  ecli: string
  courtCode: string
  courtName: string
  decisionDate: string
  roleNumber: string
  summary: string
  thesaurusCas: string[]
  keywords: string[]
  url: string
  score?: number
}

export interface WebLawyerResult {
  sessionId: string
  answer: string
  documents: JurisprudenceDocument[]
  toolCalls: ToolCallDisplay[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface UseWebLawyerOptions {
  collectionId?: string
  useJuportal?: boolean
  useRag?: boolean
  topK?: number
  language?: string
  courts?: string[]
  stream?: boolean
}

export interface UseWebLawyerReturn {
  // State
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  result: WebLawyerResult | null
  streamedAnswer: string
  toolCalls: ToolCallDisplay[]
  documents: JurisprudenceDocument[]

  // Actions
  search: (query: string) => Promise<void>
  reset: () => void
  abort: () => void
}

export function useWebLawyer(
  options: UseWebLawyerOptions = {}
): UseWebLawyerReturn {
  const {
    collectionId,
    useJuportal = true,
    useRag = true,
    topK = 10,
    language = 'FR',
    courts,
    stream = true,
  } = options

  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WebLawyerResult | null>(null)
  const [streamedAnswer, setStreamedAnswer] = useState('')
  const [toolCalls, setToolCalls] = useState<ToolCallDisplay[]>([])
  const [documents, setDocuments] = useState<JurisprudenceDocument[]>([])

  const abortControllerRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    setIsLoading(false)
    setIsStreaming(false)
    setError(null)
    setResult(null)
    setStreamedAnswer('')
    setToolCalls([])
    setDocuments([])
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }, [])

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
    setIsStreaming(false)
  }, [])

  const search = useCallback(
    async (query: string) => {
      reset()
      setIsLoading(true)

      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const response = await fetch('/api/web-lawyer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            collectionId,
            useJuportal,
            useRag,
            topK,
            language,
            courts,
            stream,
          }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Request failed')
        }

        // Streaming response
        if (stream && response.body) {
          setIsStreaming(true)
          const reader = response.body.getReader()
          const decoder = new TextDecoder()

          let buffer = ''
          let fullAnswer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue

              try {
                const event = JSON.parse(line.slice(6))

                switch (event.type) {
                  case 'tool_start':
                    setToolCalls((prev) => [
                      ...prev,
                      {
                        id: `${event.data.name}-${Date.now()}`,
                        name: event.data.name,
                        status: 'running',
                        duration: 'running...',
                        args: {},
                      },
                    ])
                    break

                  case 'tool_complete':
                    setToolCalls((prev) =>
                      prev.map((tc) =>
                        tc.name === event.data.name && tc.status === 'running'
                          ? {
                              ...tc,
                              status: event.data.success
                                ? 'completed'
                                : 'error',
                              duration: `${event.data.durationMs}ms`,
                              resultSummary: event.data.success
                                ? `Found ${event.data.itemCount} results`
                                : undefined,
                              error: event.data.error,
                            }
                          : tc
                      )
                    )
                    break

                  case 'documents':
                    setDocuments(event.data)
                    break

                  case 'token':
                    fullAnswer += event.data
                    setStreamedAnswer(fullAnswer)
                    break

                  case 'done':
                    setResult({
                      sessionId: event.data.sessionId,
                      answer: fullAnswer,
                      documents: documents,
                      toolCalls: event.data.toolCalls || toolCalls,
                      usage: event.data.usage,
                    })
                    break

                  case 'error':
                    setError(event.data.error)
                    break
                }
              } catch {
                // Ignore parse errors for incomplete chunks
              }
            }
          }

          setIsStreaming(false)
        } else {
          // Non-streaming response
          const data = await response.json()
          setResult(data)
          setStreamedAnswer(data.answer)
          setDocuments(data.documents)
          setToolCalls(data.toolCalls)
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted, don't set error
        } else {
          setError(err instanceof Error ? err.message : 'Unknown error')
        }
      } finally {
        setIsLoading(false)
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [
      collectionId,
      useJuportal,
      useRag,
      topK,
      language,
      courts,
      stream,
      reset,
      documents,
      toolCalls,
    ]
  )

  return {
    isLoading,
    isStreaming,
    error,
    result,
    streamedAnswer,
    toolCalls,
    documents,
    search,
    reset,
    abort,
  }
}

/**
 * Fetch tool definitions
 */
export async function fetchWebLawyerTools(): Promise<{
  tools: Array<{
    name: string
    description: string
    parameters: Record<string, unknown>
  }>
  courts: Record<string, string>
}> {
  const response = await fetch('/api/web-lawyer/tools')
  if (!response.ok) {
    throw new Error('Failed to fetch tools')
  }
  return response.json()
}
