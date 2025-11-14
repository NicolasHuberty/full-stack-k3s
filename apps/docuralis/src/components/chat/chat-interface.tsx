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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import ReactMarkdown from 'react-markdown'
import { AgentActions } from './agent-actions'

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
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini')
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

    try {
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
              className={`max-w-[80%] ${
                msg.role === 'USER'
                  ? 'bg-blue-500 text-white'
                  : 'bg-white border-gray-200'
              }`}
            >
              <CardContent className="p-3">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {msg.role === 'USER' ? (
                    <p className="m-0 whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
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
                            onClick={() =>
                              window.open(
                                `/api/documents/${chunk.documentId}/download`,
                                '_blank'
                              )
                            }
                            className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <FileText className="h-4 w-4 text-blue-600 flex-shrink-0" />
                                  <span className="font-medium text-sm text-gray-900 truncate">
                                    {chunk.documentName}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 pl-6">
                                  {chunk.content?.substring(0, 150) ||
                                    'No preview available'}
                                  ...
                                </p>
                                <div className="flex items-center gap-3 mt-2 pl-6">
                                  <span className="text-xs text-gray-400">
                                    Score: {(chunk.score * 100).toFixed(1)}%
                                  </span>
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
    </div>
  )
}

function MessageSquare({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
