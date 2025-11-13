'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Share2, X, Loader2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'

interface User {
  id: string
  name: string | null
  email: string
  image: string | null
}

interface SharedUser {
  userId: string
  user: User
}

interface ShareDialogProps {
  sessionId: string
  currentSharedWith: SharedUser[]
  onShareUpdate: (sharedWith: SharedUser[]) => void
}

export function ShareDialog({
  sessionId,
  currentSharedWith,
  onShareUpdate,
}: ShareDialogProps) {
  const t = useTranslations('chat')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [orgMembers, setOrgMembers] = useState<User[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (open) {
      loadOrgMembers()
      setSelectedUserIds(new Set(currentSharedWith.map((s) => s.userId)))
    }
  }, [open, currentSharedWith])

  const loadOrgMembers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/organizations/members')
      const data = await res.json()
      setOrgMembers(data.members || [])
    } catch (error) {
      console.error('Failed to load organization members:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUserIds)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUserIds(newSelected)
  }

  const handleShare = async () => {
    try {
      setLoading(true)

      // Determine users to add and remove
      const currentUserIds = new Set(currentSharedWith.map((s) => s.userId))
      const usersToAdd = Array.from(selectedUserIds).filter(
        (id) => !currentUserIds.has(id)
      )
      const usersToRemove = Array.from(currentUserIds).filter(
        (id) => !selectedUserIds.has(id)
      )

      // Add new shares
      if (usersToAdd.length > 0) {
        const addRes = await fetch(`/api/chat/sessions/${sessionId}/share`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userIds: usersToAdd }),
        })

        if (!addRes.ok) {
          throw new Error('Failed to share chat')
        }
      }

      // Remove shares
      for (const userId of usersToRemove) {
        await fetch(`/api/chat/sessions/${sessionId}/share?userId=${userId}`, {
          method: 'DELETE',
        })
      }

      // Fetch updated shared list
      const res = await fetch(`/api/chat/sessions/${sessionId}/share`)
      if (res.ok) {
        const data = await res.json()
        onShareUpdate(data.sharedWith || [])
      }

      setOpen(false)
    } catch (error) {
      console.error('Failed to update sharing:', error)
    } finally {
      setLoading(false)
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
          <Share2 className="h-3.5 w-3.5 text-gray-500" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Chat</DialogTitle>
          <DialogDescription>
            Share this chat with other members of your organization
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <ScrollArea className="h-[300px] pr-4">
              {orgMembers.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-500">
                  No organization members found
                </div>
              ) : (
                <div className="space-y-2">
                  {orgMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleUser(member.id)}
                    >
                      <Checkbox
                        checked={selectedUserIds.has(member.id)}
                        onCheckedChange={() => toggleUser(member.id)}
                      />
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.image || undefined} />
                        <AvatarFallback className="text-xs">
                          {getUserInitials(member.name, member.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {member.name || member.email}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sharing...
                  </>
                ) : (
                  'Share'
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
