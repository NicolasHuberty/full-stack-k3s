'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, MessageSquare, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { formatDistanceToNow } from 'date-fns'

interface ChatSession {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  collection: {
    id: string
    name: string
  } | null
  _count: {
    messages: number
  }
}

interface ChatListProps {
  onSelectSession: (sessionId: string) => void
  selectedSessionId?: string
  collectionId?: string
}

export function ChatList({
  onSelectSession,
  selectedSessionId,
  collectionId,
}: ChatListProps) {
  const t = useTranslations('chat')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [collectionId])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const url = collectionId
        ? `/api/chat/sessions?collectionId=${collectionId}`
        : '/api/chat/sessions'
      const res = await fetch(url)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSessions(sessions.filter((s) => s.id !== sessionId))
        if (selectedSessionId === sessionId) {
          onSelectSession('')
        }
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const startEdit = (session: ChatSession) => {
    setEditingId(session.id)
    setEditTitle(session.title || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  const saveEdit = async (sessionId: string) => {
    if (!editTitle.trim()) {
      cancelEdit()
      return
    }

    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim() }),
      })

      if (res.ok) {
        const { session } = await res.json()
        setSessions(
          sessions.map((s) => (s.id === sessionId ? { ...s, title: session.title } : s))
        )
        cancelEdit()
      }
    } catch (error) {
      console.error('Failed to update title:', error)
    }
  }

  const confirmDelete = (sessionId: string) => {
    setSessionToDelete(sessionId)
    setDeleteDialogOpen(true)
  }

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">{t('loading')}</div>
  }

  if (sessions.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        {t('noChats')}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2 p-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`cursor-pointer transition-all hover:shadow-md border rounded-lg p-3 ${
              selectedSessionId === session.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
            onClick={() => onSelectSession(session.id)}
          >
            {editingId === session.id ? (
              <div className="flex items-center gap-2 w-full" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="h-8 text-sm flex-1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(session.id)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={() => saveEdit(session.id)}
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 flex-shrink-0"
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ) : (
              <div className="w-full">
                <div className="flex items-start gap-2 w-full">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" title={session.title || t('untitled')}>
                      {session.title || t('untitled')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      {session.collection && (
                        <span className="text-blue-600">{session.collection.name} • </span>
                      )}
                      {session._count.messages} {t('messages')} •{' '}
                      {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => startEdit(session)}
                    >
                      <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => confirmDelete(session.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (sessionToDelete) {
                  handleDelete(sessionToDelete)
                  setSessionToDelete(null)
                }
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
