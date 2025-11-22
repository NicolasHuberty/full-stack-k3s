/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useRef, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import {
  Send,
  Loader2,
  FileText,
  ExternalLink,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronUp,
  Brain,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import ReactMarkdown from 'react-markdown'
import { AgentActions } from './agent-actions'
import { PDFViewer } from '@/components/pdf-viewer'
import { getCustomMarkdownComponents } from './markdown-components'

interface Message {
  id: string
  role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  content: string
  createdAt: string
  documentChunks?: any
}

interface ChatSession {
  id: string
  title: string | null
  messages: Message[]
  collection: {
    id: string
    name: string
  } | null
}

interface ChatInterfaceProps {
  sessionId?: string
  collectionId?: string
  onNewSession?: (sessionId: string) => void
  onMessageSent?: () => void
}

export function ChatInterface({
  sessionId,
  collectionId,
  onNewSession,
  onMessageSent,
}: ChatInterfaceProps) {
  const t = useTranslations('chat')
  const [session, setSession] = useState<ChatSession | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [optimisticMessage, setOptimisticMessage] = useState<string | null>(
    null
  )
  const [currentUser, setCurrentUser] = useState<{
    id: string
    name: string | null
    email: string
    image: string | null
  } | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [agentActionState, setAgentActionState] = useState<Record<string, any>>(
    {}
  )
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [pdfViewer, setPdfViewer] = useState<{
    documentId: string
    documentName: string
    collectionId?: string
    initialPage?: number | null
    highlightText?: string
  } | null>(null)
  const [agentThoughts, setAgentThoughts] = useState<
    Array<{
      type: string
      message: string
      data?: any
    }>
  >([])
  const [showThoughts, setShowThoughts] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    if (sessionId) {
      loadSession()
    } else {
      setSession(null)
    }
  }, [sessionId])

  useEffect(() => {
    scrollToBottom()
  }, [session?.messages, optimisticMessage, loading])

  useEffect(() => {
    // Fetch default model on mount
    const fetchDefaultModel = async () => {
      try {
        const res = await fetch('/api/models')
        if (res.ok) {
          const models = await res.json()
          const defaultModel = models.find((m: any) => m.isDefault)
          if (defaultModel) {
            setSelectedModel(defaultModel.name)
          } else if (models.length > 0) {
            setSelectedModel(models[0].name)
          }
        }
      } catch (error) {
        console.error('Failed to fetch default model:', error)
      }
    }
    fetchDefaultModel()
  }, [])

  const loadCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (data?.user) {
        setCurrentUser(data.user)
      }
    } catch (error) {
      console.error('Failed to load current user:', error)
    }
  }

  const getUserInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadSession = async () => {
    if (!sessionId) return

    try {
      setLoadingSession(true)
      const res = await fetch(`/api/chat/sessions/${sessionId}`)
      const data = await res.json()
      setSession(data.session)
    } catch (error) {
      console.error('Failed to load session:', error)
    } finally {
      setLoadingSession(false)
    }
  }

  const handleAgentChange = (
    agentId: string | null,
    actionState: Record<string, any>,
    model: string
  ) => {
    setSelectedAgentId(agentId)
    setAgentActionState(actionState)
    setSelectedModel(model)
  }

  const sendMessage = async () => {
    if (!message.trim() || loading) return

    const userMessage = message.trim()
    setMessage('')
    setOptimisticMessage(userMessage) // Show user message immediately
    setLoading(true)
    setAgentThoughts([]) // Clear previous thoughts
    setShowThoughts(true) // Show thoughts panel

    try {
      // Use streaming if agent is selected
      if (selectedAgentId && (collectionId || session?.collection?.id)) {
        const params = new URLSearchParams({ stream: 'true' })
        const res = await fetch(`/api/chat?${params}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({
            message: userMessage,
            sessionId: session?.id,
            collectionId: collectionId || session?.collection?.id,
            agentId: selectedAgentId,
            actionState: agentActionState,
            model: selectedModel,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to send message')
        }

        // Handle Server-Sent Events
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let finalData: any = null

        while (reader) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            if (!event.trim()) continue

            // Parse SSE format: event: xxx\ndata: {...}
            const lines = event.split('\n')
            let eventType = ''
            let eventData = ''

            for (const line of lines) {
              if (line.startsWith('event:')) {
                eventType = line.substring(6).trim()
              } else if (line.startsWith('data:')) {
                eventData = line.substring(5).trim()
              }
            }

            if (eventType && eventData) {
              try {
                const data = JSON.parse(eventData)

                if (eventType === 'progress') {
                  // Add thought to the list
                  setAgentThoughts((prev) => [
                    ...prev,
                    {
                      type: data.type,
                      message: data.data.message,
                      data: data.data,
                    },
                  ])
                } else if (eventType === 'complete') {
                  finalData = data
                } else if (eventType === 'error') {
                  console.error('[SSE] Error event:', data)
                  throw new Error(data.message)
                }
              } catch (parseError) {
                console.error(
                  '[SSE] Failed to parse event data:',
                  parseError,
                  eventData
                )
              }
            }
          }
        }

        // If this was a new session, notify parent
        if (!session && onNewSession && finalData?.sessionId) {
          onNewSession(finalData.sessionId)
        }

        // Reload the session to get updated messages
        if (finalData?.sessionId) {
          const sessionRes = await fetch(
            `/api/chat/sessions/${finalData.sessionId}`
          )
          const sessionData = await sessionRes.json()
          setSession(sessionData.session)
        }

        // Clear loading state and agent thoughts after completion
        setLoading(false)
        setAgentThoughts([])

        // Notify parent that a message was sent
        if (onMessageSent) {
          onMessageSent()
        }
      } else {
        // Non-streaming (original behavior)
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage,
            sessionId: session?.id,
            collectionId: collectionId || session?.collection?.id,
            agentId: selectedAgentId,
            actionState: agentActionState,
            model: selectedModel,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to send message')
        }

        // If this was a new session, notify parent
        if (!session && onNewSession) {
          onNewSession(data.sessionId)
        }

        // Reload the session to get updated messages
        if (data.sessionId) {
          const sessionRes = await fetch(`/api/chat/sessions/${data.sessionId}`)
          const sessionData = await sessionRes.json()
          setSession(sessionData.session)
        }

        // Notify parent that a message was sent
        if (onMessageSent) {
          onMessageSent()
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert(error instanceof Error ? error.message : 'Failed to send message')
    } finally {
      setLoading(false)
      setOptimisticMessage(null) // Clear optimistic message after real messages load
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handlePdfClick = async (filename: string, pageNumber?: number) => {
    try {
      const collectionIdToUse = collectionId || session?.collection?.id
      if (!collectionIdToUse) {
        console.error('❌ [ChatInterface] No collection ID available')
        alert('No collection selected')
        return
      }

      // Find the document by filename in the collection
      const searchUrl = `/api/collections/${collectionIdToUse}/documents?filename=${encodeURIComponent(filename)}`
      const response = await fetch(searchUrl)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ [ChatInterface] Failed to find document:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText,
        })
        alert(`Failed to search for document: ${response.statusText}`)
        return
      }

      const data = await response.json()

      if (data.documents && data.documents.length > 0) {
        const document = data.documents[0]

        // Use the exact same property names as the source cards
        const pdfViewerData = {
          documentId: document.id,
          documentName: document.originalName || document.filename,
          collectionId: collectionIdToUse,
          initialPage: pageNumber || null,
        }
        setPdfViewer(pdfViewerData)
      } else {
        console.error('❌ [ChatInterface] Document not found:', filename)
        alert(`Document "${filename}" not found in the collection`)
      }
    } catch (error) {
      console.error('❌ [ChatInterface] Error opening PDF:', error)
      alert(
        `Failed to open PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {session && (
        <div className="border-b bg-white p-4">
          <h2
            className="text-lg font-semibold truncate"
            title={session.title || 'Chat Session'}
          >
            {session.title || 'Chat Session'}
          </h2>
          {session.collection && (
            <p
              className="text-sm text-gray-500 truncate"
              title={session.collection.name}
            >
              Collection: {session.collection.name}
            </p>
          )}
        </div>
      )}

      {/* Agent Actions Bar */}
      {(collectionId || session?.collection?.id) && (
        <AgentActions
          collectionId={collectionId || session?.collection?.id || ''}
          onAgentChange={handleAgentChange}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {!session && (
          <div className="text-center text-gray-500 mt-8">
            <MessageSquare className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">{t('startConversation')}</p>
            <p className="text-sm mt-2">
              {collectionId ? t('askAboutDocs') : t('selectOrGeneral')}
            </p>
          </div>
        )}

        {session?.messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'USER' ? 'justify-end' : 'justify-start'}`}
          >
            {/* AI Avatar - Left side */}
            {msg.role === 'ASSISTANT' && (
              <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                <img
                  src="/docuralis.ico"
                  alt="AI"
                  className="h-8 w-8 rounded-full bg-white border border-gray-200"
                />
              </Avatar>
            )}

            <Card
              className={`max-w-[80%] ${msg.role === 'USER'
                ? 'bg-blue-500 text-white'
                : 'bg-white border-gray-200'
                }`}
            >
              <CardContent className="p-3">
                <div className="max-w-none">
                  {msg.role === 'USER' ? (
                    <p className="m-0 whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown
                      components={getCustomMarkdownComponents({
                        onPdfClick: handlePdfClick,
                        documentChunks: msg.documentChunks,
                      })}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
                {Array.isArray(msg.documentChunks) &&
                  msg.documentChunks.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-semibold text-gray-700">
                          {t('sources')} ({msg.documentChunks.length})
                        </span>
                      </div>
                      <div className="space-y-2">
                        {msg.documentChunks.map((chunk: any, i: number) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (chunk?.documentId && chunk?.documentName) {
                                // Use chunk's collectionId if available, otherwise fall back to session's collection ID
                                const effectiveCollectionId =
                                  chunk.collectionId || session?.collection?.id
                                // Extract page number if available
                                let pageNumber =
                                  chunk.pageNumber ||
                                  chunk.metadata?.pageNumber ||
                                  null

                                // Convert to number and validate
                                if (
                                  pageNumber !== null &&
                                  pageNumber !== undefined
                                ) {
                                  pageNumber =
                                    typeof pageNumber === 'string'
                                      ? parseInt(pageNumber, 10)
                                      : Number(pageNumber)
                                  if (isNaN(pageNumber) || pageNumber <= 0) {
                                    pageNumber = null
                                  }
                                }
                                setPdfViewer({
                                  documentId: chunk.documentId,
                                  documentName: chunk.documentName,
                                  collectionId: effectiveCollectionId,
                                  initialPage: pageNumber,
                                  highlightText: chunk.content,
                                })
                              }
                            }}
                            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                  <span className="font-medium text-sm text-gray-900 truncate">
                                    {chunk?.documentName || 'Unknown Document'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 pl-6">
                                  {chunk?.content?.substring(0, 150) ||
                                    'No preview available'}
                                  ...
                                </p>
                                <div className="flex items-center gap-3 mt-2 pl-6">
                                  <span className="text-xs text-gray-400">
                                    Score:{' '}
                                    {chunk?.score
                                      ? (chunk.score * 100).toFixed(1)
                                      : '0.0'}
                                    %
                                  </span>
                                  {(chunk?.pageNumber ||
                                    chunk?.metadata?.pageNumber) && (
                                      <span className="text-xs text-blue-600 font-medium">
                                        Page{' '}
                                        {chunk.pageNumber ||
                                          chunk.metadata.pageNumber}
                                      </span>
                                    )}
                                </div>
                              </div>
                              <ExternalLink className="h-4 w-4 text-gray-400 group-hover:text-blue-600 flex-shrink-0 mt-1" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>

            {/* User Avatar - Right side */}
            {msg.role === 'USER' && currentUser && (
              <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                <AvatarImage src={currentUser.image || undefined} />
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {getUserInitials(currentUser.name, currentUser.email)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ))}
        {/* Optimistic user message while waiting for response */}
        {optimisticMessage && (
          <div className="flex gap-3 justify-end">
            <Card className="max-w-[80%] bg-blue-500 text-white">
              <CardContent className="p-3">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <p className="m-0 whitespace-pre-wrap">{optimisticMessage}</p>
                </div>
              </CardContent>
            </Card>
            {currentUser && (
              <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
                <AvatarImage src={currentUser.image || undefined} />
                <AvatarFallback className="bg-blue-600 text-white text-xs">
                  {getUserInitials(currentUser.name, currentUser.email)}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        )}

        {/* Agent Thoughts - Collapsible */}
        {agentThoughts.length > 0 && (
          <div className="flex gap-3 justify-start">
            <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
              <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-600">
                <Brain className="h-4 w-4 text-white" />
              </AvatarFallback>
            </Avatar>
            <Card className="max-w-[80%] bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardContent className="p-3">
                <button
                  onClick={() => setShowThoughts(!showThoughts)}
                  className="flex items-center gap-2 w-full text-left mb-2 text-purple-900 font-medium hover:text-purple-700"
                >
                  {showThoughts ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <Brain className="h-4 w-4" />
                  <span>
                    Processus de réflexion ({agentThoughts.length} étapes)
                  </span>
                </button>

                {showThoughts && (
                  <div className="space-y-3 text-sm">
                    {agentThoughts.map((thought, idx) => {
                      const isLastThought = idx === agentThoughts.length - 1
                      const isCompleted = idx < agentThoughts.length - 1

                      return (
                        <div
                          key={idx}
                          className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm"
                        >
                          <div className="flex items-start gap-2 mb-2">
                            {isLastThought ? (
                              <Loader2 className="h-4 w-4 animate-spin text-purple-600 mt-0.5 flex-shrink-0" />
                            ) : (
                              <svg
                                className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                            <span
                              className={`font-semibold ${isCompleted ? 'text-gray-700' : 'text-gray-900'}`}
                            >
                              {thought.message}
                            </span>
                          </div>

                          {thought.data?.subQueries &&
                            thought.data.subQueries.length > 0 && (
                              <div className="mt-3 pl-4 space-y-1.5 border-l-2 border-purple-300">
                                {thought.data.subQueries.map(
                                  (q: string, i: number) => (
                                    <div
                                      key={i}
                                      className="text-xs text-gray-700 leading-relaxed"
                                    >
                                      <span className="font-bold text-purple-700">
                                        {i + 1}.
                                      </span>{' '}
                                      {q}
                                    </div>
                                  )
                                )}
                              </div>
                            )}

                          {thought.data?.count !== undefined && (
                            <div className="mt-2 text-xs text-gray-600 italic">
                              {thought.data.count} documents trouvés
                            </div>
                          )}

                          {thought.data?.documents &&
                            thought.data.documents.length > 0 && (
                              <div className="mt-3 pl-4 border-l-2 border-purple-300">
                                <div className="text-xs font-semibold text-gray-700 mb-2">
                                  📚 Documents analysés (
                                  {thought.data.documents.length}) :
                                </div>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                  {thought.data.documents.map(
                                    (d: any, i: number) => (
                                      <div
                                        key={i}
                                        className="flex items-start gap-2 text-xs"
                                      >
                                        <span className="text-purple-600 font-bold">
                                          •
                                        </span>
                                        <div className="flex-1">
                                          <div className="font-medium text-gray-800">
                                            {d.title}
                                          </div>
                                          {d.score && (
                                            <div className="text-gray-500 text-[10px]">
                                              Score: {d.score.toFixed(1)}/10
                                            </div>
                                          )}
                                          {d.justification && (
                                            <div className="text-gray-600 text-[10px] mt-0.5 italic">
                                              {d.justification.substring(
                                                0,
                                                100
                                              )}
                                              ...
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI loading indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <Avatar className="h-8 w-8 flex-shrink-0 mt-1">
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600">
                <Bot className="h-4 w-4 text-white" />
              </AvatarFallback>
            </Avatar>
            <Card className="bg-white">
              <CardContent className="p-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              </CardContent>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t bg-white p-4">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('typePlaceholder')}
            className="resize-none"
            rows={3}
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={!message.trim() || loading}
            className="self-end"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      {pdfViewer && (
        <PDFViewer
          documentId={pdfViewer.documentId}
          documentName={pdfViewer.documentName}
          collectionId={pdfViewer.collectionId}
          initialPage={pdfViewer.initialPage || undefined}
          highlightText={pdfViewer.highlightText}
          onClose={() => setPdfViewer(null)}
        />
      )}
    </div>
  )
}
