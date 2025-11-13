'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { DashboardLayout } from '@/components/dashboard/layout'
import { ChatList } from '@/components/chat/chat-list'
import { ChatInterface } from '@/components/chat/chat-interface'
import { Button } from '@/components/ui/button'
import { Plus, MessageSquare, FolderOpen } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Collection {
  id: string
  name: string
  documentCount: number
}

export default function ChatPage() {
  const t = useTranslations('chat')
  const [selectedSessionId, setSelectedSessionId] = useState<string>('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('')
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const handleSelectSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setShowNewChat(false)
  }

  const handleNewChat = () => {
    setSelectedSessionId('')
    setShowNewChat(true)
  }

  const handleNewSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setShowNewChat(false)
    setRefreshTrigger((prev) => prev + 1)
  }

  const handleMessageSent = () => {
    setRefreshTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections')
      if (res.ok) {
        const data = await res.json()
        setCollections(data.collections)
        // Auto-select first collection if available
        if (data.collections.length > 0) {
          setSelectedCollectionId(data.collections[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="flex h-full bg-gray-50">
        {/* Sidebar - Chat List */}
        <div className="w-80 bg-white border-r flex flex-col">
          <div className="p-4 border-b space-y-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="h-6 w-6" />
              {t('title')}
            </h1>

            {/* Collection Selector */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <FolderOpen className="h-3 w-3" />
                Collection
              </label>
              <Select
                value={selectedCollectionId}
                onValueChange={setSelectedCollectionId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((col) => (
                    <SelectItem key={col.id} value={col.id}>
                      {col.name} ({col.documentCount} docs)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleNewChat}
              className="w-full"
              size="sm"
              disabled={!selectedCollectionId}
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('newChat')}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ChatList
              onSelectSession={handleSelectSession}
              selectedSessionId={selectedSessionId}
              refreshTrigger={refreshTrigger}
            />
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {showNewChat || selectedSessionId ? (
            <ChatInterface
              sessionId={selectedSessionId || undefined}
              collectionId={selectedCollectionId}
              onNewSession={handleNewSession}
              onMessageSent={handleMessageSent}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <MessageSquare className="h-24 w-24 mx-auto mb-4 text-gray-300" />
                <h2 className="text-2xl font-semibold mb-2">{t('welcome')}</h2>
                <p className="text-gray-600 mb-6">{t('selectOrStart')}</p>
                <Button onClick={handleNewChat}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('startNewChat')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
