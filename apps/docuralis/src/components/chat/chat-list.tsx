'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Trash2, MessageSquare, Edit2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDistanceToNow } from 'date-fns'
import { ShareDialog } from './share-dialog'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface SharedWith {
  userId: string
  user: User
}

interface ChatSession {
  id: string
  title: string | null
  userId: string
  user: User
  createdAt: string
  updatedAt: string
  collection: {
    id: string
    name: string
  } | null
  sharedWith: SharedWith[]
  _count: {
    messages: number
  }
}

interface ChatListProps {
  onSelectSession: (sessionId: string) => void
  selectedSessionId?: string
  collectionId?: string
  refreshTrigger?: number
}

export function ChatList({
  onSelectSession,
  selectedSessionId,
  collectionId,
  refreshTrigger,
}: ChatListProps) {
  const t = useTranslations('chat')
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'owned' | 'shared'>('all')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    loadSessions()
  }, [collectionId, filter, refreshTrigger])

  const loadCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (data?.user?.id) {
        setCurrentUserId(data.user.id)
      }
    } catch (error) {
      console.error('Failed to load current user:', error)
    }
  }

  const loadSessions = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (collectionId) params.append('collectionId', collectionId)
      params.append('filter', filter)

      const url = `/api/chat/sessions?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to load sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShareUpdate = (sessionId: string, sharedWith: SharedWith[]) => {
    setSessions(
      sessions.map((s) =>
        s.id === sessionId ? { ...s, sharedWith } : s
      )
    )
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
          sessions.map((s) =>
            s.id === sessionId ? { ...s, title: session.title } : s
          )
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

  return (
    <>
      {/* Filter Dropdown */}
      <div className="p-4 pb-2">
        <Select value={filter} onValueChange={(value: 'all' | 'owned' | 'shared') => setFilter(value)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allChats')}</SelectItem>
            <SelectItem value="owned">{t('myChats')}</SelectItem>
            <SelectItem value="shared">{t('sharedWithMe')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="p-4 text-sm text-gray-500">{t('loading')}</div>
      ) : sessions.length === 0 ? (
        <div className="p-4 text-center text-sm text-gray-500">
          {filter === 'shared' ? t('noSharedChats') : t('noChats')}
        </div>
      ) : (
        <div className="space-y-2 p-4 pt-2">
          {sessions.map((session) => {
            const isOwner = currentUserId === session.userId
            const isShared = !isOwner

            return (
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
              <div
                className="flex items-center gap-2 w-full"
                onClick={(e) => e.stopPropagation()}
              >
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
                    <div
                      className="text-sm font-semibold truncate"
                      title={session.title || t('untitled')}
                    >
                      {session.title || t('untitled')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {session.collection && (
                        <span className="text-blue-600">
                          {session.collection.name} •{' '}
                        </span>
                      )}
                      {session._count.messages} {t('messages')} •{' '}
                      {formatDistanceToNow(new Date(session.updatedAt), {
                        addSuffix: true,
                      })}
                      {isShared && (
                        <span className="ml-2 text-purple-600">
                          • {t('sharedBy')} {session.user.name || session.user.email}
                        </span>
                      )}
                    </div>
                    {/* Show shared users avatars */}
                    {isOwner && session.sharedWith.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <div className="flex -space-x-2">
                          {session.sharedWith.slice(0, 3).map((shared) => (
                            <Avatar
                              key={shared.userId}
                              className="h-5 w-5 border-2 border-white"
                              title={shared.user.name || shared.user.email}
                            >
                              <AvatarImage src={shared.user.image || undefined} />
                              <AvatarFallback className="text-[10px]">
                                {getUserInitials(shared.user.name, shared.user.email)}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                        </div>
                        {session.sharedWith.length > 3 && (
                          <span className="text-[10px] text-gray-500">
                            +{session.sharedWith.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div
                    className="flex gap-1 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isOwner && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => startEdit(session)}
                        >
                          <Edit2 className="h-3.5 w-3.5 text-gray-500" />
                        </Button>
                        <ShareDialog
                          sessionId={session.id}
                          currentSharedWith={session.sharedWith}
                          onShareUpdate={(sharedWith) =>
                            handleShareUpdate(session.id, sharedWith)
                          }
                        />
                      </>
                    )}
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
            )
          })}
        </div>
      )}

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
