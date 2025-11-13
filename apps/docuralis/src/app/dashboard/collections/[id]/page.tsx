/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */
'use client'

import * as React from 'react'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Upload,
  FileText,
  Trash2,
  Eye,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowLeft,
  Users,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  Shield,
  MoreVertical,
  Download,
  UserPlus,
  Edit2,
  File,
  Mail,
  FolderUp,
  Bot,
  Plus,
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { fr } from 'date-fns/locale'
import { PermissionBadge } from '@/components/collections/permission-badge'
import { VisibilityBadge } from '@/components/collections/visibility-badge'
import { formatBytes } from '@/lib/utils/format'

type DocumentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'

interface Document {
  id: string
  filename: string
  originalName: string
  mimeType: string
  fileSize: bigint | number
  status: DocumentStatus
  uploadedBy: {
    name: string | null
    email: string
    image: string | null
  }
  createdAt: string
  processedAt: string | null
  totalChunks: number
  updatedAt: string
  processingError?: string | null
}

interface AccessUser {
  id: string
  name: string | null
  email: string
  image: string | null
  permission: 'VIEWER' | 'EDITOR' | 'ADMIN'
}

interface Collection {
  id: string
  name: string
  description: string | null
  visibility: string
  documentCount: number
  storageUsed: bigint | number
  documents: Document[]
  accessUsers: AccessUser[]
  lastDocumentUpdate: string | null
  lastChatActivity: string | null
  totalChatMessages: number
}

interface CollectionAgent {
  id: string
  agent: {
    id: string
    name: string
    description: string
    icon?: string
  }
  actionState: Record<string, any>
  isActive: boolean
}

export default function CollectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const t = useTranslations('collectionDetail')
  const [collection, setCollection] = useState<Collection | null>(null)
  const [agents, setAgents] = useState<CollectionAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [message, setMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>(
    'all'
  )
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [displayedCount, setDisplayedCount] = useState(20)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const observerTarget = React.useRef<HTMLDivElement>(null)

  // Access management state
  const [showAccessDialog, setShowAccessDialog] = useState(false)
  const [editingAccess, setEditingAccess] = useState<AccessUser | null>(null)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserRole, setNewUserRole] = useState<'VIEWER' | 'EDITOR' | 'ADMIN'>(
    'VIEWER'
  )
  const [accessLoading, setAccessLoading] = useState(false)

  // Batch selection state
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [showBatchDelete, setShowBatchDelete] = useState(false)

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false)

  const collectionId = params.id as string

  // Calculate filtered and sorted documents
  const allFilteredAndSorted = React.useMemo(() => {
    if (!collection) return []

    let filtered = collection.documents

    if (searchQuery) {
      filtered = filtered.filter(
        (doc) =>
          doc.originalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doc.uploadedBy.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((doc) => doc.status === statusFilter)
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.originalName.localeCompare(b.originalName)
          break
        case 'date':
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'size':
          comparison = Number(a.fileSize) - Number(b.fileSize)
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }, [collection, searchQuery, statusFilter, sortBy, sortOrder])

  const filteredAndSortedDocuments = allFilteredAndSorted.slice(
    0,
    displayedCount
  )
  const hasMore = allFilteredAndSorted.length > displayedCount

  useEffect(() => {
    fetchCollection()
    fetchAgents()
  }, [collectionId])

  // Auto-refresh every 5 seconds if there are pending/processing documents
  useEffect(() => {
    if (!collection) return

    const hasProcessingDocs = collection.documents.some(
      (doc) => doc.status === 'PENDING' || doc.status === 'PROCESSING'
    )

    if (!hasProcessingDocs) return

    const interval = setInterval(() => {
      fetchCollection(true) // Silent refresh
    }, 5000) // Every 5 seconds

    return () => clearInterval(interval)
  }, [collection])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && hasMore) {
          console.log('Loading more documents...')
          setIsLoadingMore(true)
          setTimeout(() => {
            setDisplayedCount((prev) => prev + 20)
            setIsLoadingMore(false)
          }, 300)
        }
      },
      { threshold: 0.1, root: null, rootMargin: '100px' }
    )

    const currentTarget = observerTarget.current
    if (currentTarget && hasMore) {
      console.log(
        'Observer attached, hasMore:',
        hasMore,
        'displayed:',
        displayedCount
      )
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [isLoadingMore, hasMore, displayedCount])

  useEffect(() => {
    setDisplayedCount(20)
  }, [searchQuery, statusFilter, sortBy, sortOrder])

  const fetchCollection = async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const res = await fetch(`/api/collections/${collectionId}`)
      if (res.ok) {
        const data = await res.json()
        setCollection(data.collection)
      } else {
        setMessage({ type: 'error', text: t('fetchError') })
      }
    } catch (error) {
      console.error('Failed to fetch collection:', error)
      setMessage({ type: 'error', text: t('fetchError') })
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const res = await fetch(`/api/collections/${collectionId}/agents`)
      if (res.ok) {
        const data = await res.json()
        setAgents(data)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const items = Array.from(e.dataTransfer.items)
    const files: File[] = []

    // Helper function to recursively read directory entries
    const readDirectory = async (entry: any): Promise<File[]> => {
      const dirFiles: File[] = []

      if (entry.isFile) {
        return new Promise((resolve) => {
          entry.file((file: File) => {
            resolve([file])
          })
        })
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader()

        // Read all entries in the directory
        const readEntries = (): Promise<any[]> => {
          return new Promise((resolve) => {
            dirReader.readEntries(async (entries: any[]) => {
              if (entries.length === 0) {
                resolve([])
              } else {
                // Process current batch and read more
                const moreEntries = await readEntries()
                resolve([...entries, ...moreEntries])
              }
            })
          })
        }

        const entries = await readEntries()

        // Recursively process all entries
        for (const entry of entries) {
          const entryFiles = await readDirectory(entry)
          dirFiles.push(...entryFiles)
        }
      }

      return dirFiles
    }

    // Process all dropped items (files and folders)
    for (const item of items) {
      const entry = item.webkitGetAsEntry()
      if (entry) {
        const entryFiles = await readDirectory(entry)
        files.push(...entryFiles)
      }
    }

    if (files.length > 0) {
      await uploadFiles(files)
    }
  }, [])

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      await uploadFiles(files)
    }
    // Reset input value so the same file can be selected again
    e.target.value = ''
  }

  const handleFolderInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      await uploadFiles(files)
    }
    // Reset input value so the same folder can be selected again
    e.target.value = ''
  }

  const uploadFiles = async (files: File[]) => {
    setUploading(true)
    setMessage(null)

    try {
      let successCount = 0
      let errorCount = 0

      for (const file of files) {
        try {
          const formData = new FormData()
          formData.append('file', file)

          const res = await fetch(
            `/api/collections/${collectionId}/documents`,
            {
              method: 'POST',
              body: formData,
            }
          )

          if (res.ok) {
            successCount++
          } else {
            errorCount++
            const error = await res.json()
            console.error(`Failed to upload ${file.name}:`, error.error)
          }
        } catch (err) {
          errorCount++
          console.error(`Failed to upload ${file.name}:`, err)
        }
      }

      if (errorCount === 0) {
        setMessage({
          type: 'success',
          text:
            files.length === 1
              ? t('uploadSuccess')
              : `${successCount} ${t('uploadSuccess')}`,
        })
      } else if (successCount > 0) {
        setMessage({
          type: 'error',
          text: `${successCount} uploaded, ${errorCount} failed`,
        })
      } else {
        setMessage({ type: 'error', text: t('uploadError') })
      }

      // Refresh silently without showing loading spinner
      await fetchCollection(true)
    } catch (error) {
      console.error('Failed to upload files:', error)
      setMessage({ type: 'error', text: t('uploadError') })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteDocument = async () => {
    if (!deleteDocId) return

    try {
      const res = await fetch(`/api/documents/${deleteDocId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setMessage({ type: 'success', text: t('deleteSuccess') })
        setDeleteDocId(null)
        // Refresh silently without showing loading spinner
        await fetchCollection(true)
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.error || t('deleteError') })
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      setMessage({ type: 'error', text: t('deleteError') })
    }
  }

  const handleAddAccess = async () => {
    if (!newUserEmail.trim()) return

    setAccessLoading(true)
    try {
      const res = await fetch(`/api/collections/${collectionId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          permission: newUserRole,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: 'Access granted successfully' })
        setShowAccessDialog(false)
        setNewUserEmail('')
        setNewUserRole('VIEWER')
        await fetchCollection(true)
      } else {
        const error = await res.json()
        setMessage({
          type: 'error',
          text: error.error || 'Failed to grant access',
        })
      }
    } catch (error) {
      console.error('Failed to add access:', error)
      setMessage({ type: 'error', text: 'Failed to grant access' })
    } finally {
      setAccessLoading(false)
    }
  }

  const handleUpdateAccess = async (
    userId: string,
    permission: 'VIEWER' | 'EDITOR' | 'ADMIN'
  ) => {
    setAccessLoading(true)
    try {
      const res = await fetch(
        `/api/collections/${collectionId}/permissions/${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ permission }),
        }
      )

      if (res.ok) {
        setMessage({ type: 'success', text: 'Access updated successfully' })
        setEditingAccess(null)
        await fetchCollection(true)
      } else {
        const error = await res.json()
        setMessage({
          type: 'error',
          text: error.error || 'Failed to update access',
        })
      }
    } catch (error) {
      console.error('Failed to update access:', error)
      setMessage({ type: 'error', text: 'Failed to update access' })
    } finally {
      setAccessLoading(false)
    }
  }

  const handleRemoveAccess = async (userId: string) => {
    setAccessLoading(true)
    try {
      const res = await fetch(
        `/api/collections/${collectionId}/permissions/${userId}`,
        {
          method: 'DELETE',
        }
      )

      if (res.ok) {
        setMessage({ type: 'success', text: 'Access removed successfully' })
        await fetchCollection(true)
      } else {
        const error = await res.json()
        setMessage({
          type: 'error',
          text: error.error || 'Failed to remove access',
        })
      }
    } catch (error) {
      console.error('Failed to remove access:', error)
      setMessage({ type: 'error', text: 'Failed to remove access' })
    } finally {
      setAccessLoading(false)
    }
  }

  // Batch selection handlers
  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(docId)) {
        newSet.delete(docId)
      } else {
        newSet.add(docId)
      }
      return newSet
    })
  }

  const toggleSelectAll = (docs: Document[]) => {
    if (selectedDocIds.size === docs.length && docs.length > 0) {
      setSelectedDocIds(new Set())
    } else {
      setSelectedDocIds(new Set(docs.map((doc) => doc.id)))
    }
  }

  const handleBatchDelete = async () => {
    if (selectedDocIds.size === 0) return

    try {
      let successCount = 0
      let errorCount = 0

      for (const docId of Array.from(selectedDocIds)) {
        try {
          const res = await fetch(`/api/documents/${docId}`, {
            method: 'DELETE',
          })

          if (res.ok) {
            successCount++
          } else {
            errorCount++
          }
        } catch (err) {
          errorCount++
          console.error(`Failed to delete document ${docId}:`, err)
        }
      }

      if (errorCount === 0) {
        setMessage({
          type: 'success',
          text: `Successfully deleted ${successCount} document${successCount > 1 ? 's' : ''}`,
        })
      } else if (successCount > 0) {
        setMessage({
          type: 'error',
          text: `${successCount} deleted, ${errorCount} failed`,
        })
      } else {
        setMessage({ type: 'error', text: 'Failed to delete documents' })
      }

      setSelectedDocIds(new Set())
      setShowBatchDelete(false)
      await fetchCollection(true)
    } catch (error) {
      console.error('Failed to delete documents:', error)
      setMessage({ type: 'error', text: 'Failed to delete documents' })
    }
  }

  const handleViewDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/download`)

      if (!response.ok) {
        const error = await response.json()
        setMessage({
          type: 'error',
          text: error.error || 'Failed to download document',
        })
        return
      }

      // Open in new tab if successful
      window.open(`/api/documents/${documentId}/download`, '_blank')
    } catch (error) {
      console.error('Failed to view document:', error)
      setMessage({
        type: 'error',
        text: 'Failed to download document. The file may not exist in storage.',
      })
    }
  }

  const getFileIcon = (mimeType: string, filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase()

    let iconUrl = ''
    let bgColor = 'bg-gray-100'

    // PDF
    if (mimeType === 'application/pdf' || extension === 'pdf') {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/337/337946.png'
      bgColor = 'bg-white'
    }
    // Word documents
    else if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword' ||
      extension === 'doc' ||
      extension === 'docx'
    ) {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/337/337932.png'
      bgColor = 'bg-white'
    }
    // Excel
    else if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      mimeType === 'application/vnd.ms-excel' ||
      extension === 'xls' ||
      extension === 'xlsx'
    ) {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/337/337958.png'
      bgColor = 'bg-white'
    }
    // PowerPoint
    else if (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mimeType === 'application/vnd.ms-powerpoint' ||
      extension === 'ppt' ||
      extension === 'pptx'
    ) {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/337/337949.png'
      bgColor = 'bg-white'
    }
    // Email
    else if (mimeType === 'message/rfc822' || extension === 'eml') {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/732/732200.png'
      bgColor = 'bg-white'
    }
    // Text
    else if (mimeType === 'text/plain' || extension === 'txt') {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/337/337940.png'
      bgColor = 'bg-white'
    }
    // Markdown
    else if (mimeType === 'text/markdown' || extension === 'md') {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/337/337940.png'
      bgColor = 'bg-white'
    }
    // Default
    else {
      iconUrl = 'https://cdn-icons-png.flaticon.com/512/337/337940.png'
      bgColor = 'bg-white'
    }

    return (
      <div
        className={`h-10 w-10 rounded ${bgColor} flex items-center justify-center flex-shrink-0 p-1.5`}
      >
        <img
          src={iconUrl}
          alt={extension || 'file'}
          className="w-full h-full object-contain"
        />
      </div>
    )
  }

  const getStatusBadge = (status: DocumentStatus) => {
    const badges = {
      COMPLETED: {
        label: 'Terminé',
        class: 'bg-green-50 text-green-700 border-green-200',
      },
      PROCESSING: {
        label: 'En traitement',
        class: 'bg-blue-50 text-blue-700 border-blue-200',
      },
      FAILED: {
        label: 'Échoué',
        class: 'bg-red-50 text-red-700 border-red-200',
      },
      PENDING: {
        label: 'En attente',
        class: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      },
    }
    const badge = badges[status]
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${badge.class}`}
      >
        {badge.label}
      </span>
    )
  }

  const handleSort = (column: 'name' | 'date' | 'size') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    )
  }

  if (!collection) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">{t('notFound')}</p>
          <Button
            onClick={() => router.push('/dashboard/collections')}
            className="mt-4"
          >
            {t('backToCollections')}
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col bg-background">
        {/* Top Bar */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between max-w-[2000px] mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/collections')}
                className="text-muted-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Collections
              </Button>
              <div className="h-6 w-px bg-border" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">
                  {collection.name}
                </h1>
                {collection.description && (
                  <p className="text-sm text-muted-foreground">
                    {collection.description}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{collection.documentCount}</span>
                <span className="text-muted-foreground">docs</span>
              </div>
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {formatBytes(collection.storageUsed)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {collection.totalChatMessages}
                </span>
                <span className="text-muted-foreground">messages</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {collection.accessUsers.length}
                </span>
                <span className="text-muted-foreground">users</span>
              </div>
            </div>
          </div>
        </div>

        {message && (
          <div
            className={`mx-6 mt-4 p-3 rounded border text-sm ${message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}
          >
            {message.text}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-[2000px] mx-auto p-6">
            {/* Activity Summary */}
            <div className="mb-6 grid grid-cols-3 gap-6 text-sm">
              <div className="border rounded p-4 bg-card">
                <div className="text-muted-foreground mb-1">
                  Dernière mise à jour
                </div>
                <div className="font-medium">
                  {collection.lastDocumentUpdate
                    ? formatDistanceToNow(
                        new Date(collection.lastDocumentUpdate),
                        { addSuffix: true, locale: fr }
                      )
                    : 'Jamais'}
                </div>
              </div>
              <div className="border rounded p-4 bg-card">
                <div className="text-muted-foreground mb-1">
                  Dernière activité chat
                </div>
                <div className="font-medium">
                  {collection.lastChatActivity
                    ? formatDistanceToNow(
                        new Date(collection.lastChatActivity),
                        { addSuffix: true, locale: fr }
                      )
                    : 'Aucune activité'}
                </div>
              </div>
              <div className="border rounded p-4 bg-card">
                <div className="text-muted-foreground mb-1">Visibilité</div>
                <div className="font-medium">
                  <VisibilityBadge
                    visibility={
                      collection.visibility as
                        | 'PRIVATE'
                        | 'ORGANIZATION'
                        | 'PUBLIC'
                    }
                  />
                </div>
              </div>
            </div>

            {/* Connected Agents */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  Connected Agents ({agents.filter(a => a.isActive).length})
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => router.push('/dashboard/agents')}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Browse Agents
                </Button>
              </div>

              {agents.length === 0 ? (
                <div className="border rounded-lg p-8 bg-card text-center">
                  <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <h3 className="font-medium mb-2">No agents connected</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Activate intelligent agents to enhance your collection with automated workflows
                  </p>
                  <Button
                    variant="default"
                    onClick={() => router.push('/dashboard/agents')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Browse Agent Marketplace
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agents.map((collectionAgent) => (
                    <div
                      key={collectionAgent.id}
                      className="border rounded-lg p-4 bg-card hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">
                            {collectionAgent.agent.icon || '🤖'}
                          </div>
                          <div>
                            <h3 className="font-medium">
                              {collectionAgent.agent.name}
                            </h3>
                            {collectionAgent.isActive ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <span className="h-2 w-2 rounded-full bg-green-600"></span>
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                                <span className="h-2 w-2 rounded-full bg-gray-400"></span>
                                Inactive
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {collectionAgent.agent.description}
                      </p>
                      {collectionAgent.actionState &&
                       Object.keys(collectionAgent.actionState).length > 0 && (
                        <div className="border-t pt-3">
                          <div className="text-xs text-muted-foreground mb-2">
                            Enabled Actions:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(collectionAgent.actionState)
                              .filter(([_, enabled]) => enabled)
                              .map(([action]) => (
                                <span
                                  key={action}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
                                >
                                  {action}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                      <div className="mt-3 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full"
                          onClick={() => router.push(`/dashboard/agents/${collectionAgent.agent.id}`)}
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Access Users */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                  Accès équipe ({collection.accessUsers.length})
                </h2>
                <Dialog
                  open={showAccessDialog}
                  onOpenChange={setShowAccessDialog}
                >
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Ajouter un utilisateur
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Accorder l'accès</DialogTitle>
                      <DialogDescription>
                        Ajouter un utilisateur à cette collection par email
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="utilisateur@exemple.com"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Rôle</Label>
                        <Select
                          value={newUserRole}
                          onValueChange={(value: any) => setNewUserRole(value)}
                        >
                          <SelectTrigger id="role">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="VIEWER">
                              Lecteur (Lecture seule)
                            </SelectItem>
                            <SelectItem value="EDITOR">
                              Éditeur (Peut modifier)
                            </SelectItem>
                            <SelectItem value="ADMIN">
                              Administrateur (Accès complet)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setShowAccessDialog(false)}
                        disabled={accessLoading}
                      >
                        Annuler
                      </Button>
                      <Button
                        onClick={handleAddAccess}
                        disabled={accessLoading || !newUserEmail.trim()}
                      >
                        {accessLoading ? 'Ajout...' : 'Ajouter'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="border rounded bg-card">
                {collection.accessUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucun utilisateur n'a encore accès
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Rôle</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {collection.accessUsers.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <Avatar className="h-8 w-8">
                              <AvatarImage
                                src={user.image || undefined}
                                alt={user.name || user.email}
                              />
                              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                                {(user.name || user.email)
                                  .charAt(0)
                                  .toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell className="font-medium">
                            {user.name || 'Unknown'}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {user.email}
                          </TableCell>
                          <TableCell>
                            {editingAccess?.id === user.id ? (
                              <Select
                                value={editingAccess.permission}
                                onValueChange={(value: any) => {
                                  handleUpdateAccess(user.id, value)
                                }}
                                disabled={accessLoading}
                              >
                                <SelectTrigger className="w-[140px] h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="VIEWER">
                                    Lecteur
                                  </SelectItem>
                                  <SelectItem value="EDITOR">
                                    Éditeur
                                  </SelectItem>
                                  <SelectItem value="ADMIN">
                                    Administrateur
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <PermissionBadge permission={user.permission} />
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setEditingAccess(user)}
                                disabled={accessLoading}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                                onClick={() => handleRemoveAccess(user.id)}
                                disabled={accessLoading}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            {/* Documents Section */}
            <div
              className={`relative border rounded bg-card transition-colors ${dragActive ? 'border-primary border-2 bg-primary/5' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              {/* Drag Overlay */}
              {dragActive && (
                <div className="absolute inset-0 z-50 bg-primary/10 border-2 border-dashed border-primary rounded flex items-center justify-center">
                  <div className="text-center">
                    <Upload className="h-12 w-12 mx-auto text-primary mb-2" />
                    <p className="text-lg font-semibold text-primary">
                      Drop files here to upload
                    </p>
                  </div>
                </div>
              )}
              {/* Header with Search and Upload */}
              <div className="border-b p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold">
                    Documents ({allFilteredAndSorted.length})
                  </h2>
                  <div>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileInput}
                      className="hidden"
                      accept=".pdf,.txt,.doc,.docx,.eml"
                      disabled={uploading}
                      id="file-upload"
                    />
                    <input
                      type="file"
                      multiple
                      onChange={handleFolderInput}
                      className="hidden"
                      {...({ webkitdirectory: '', directory: '' } as any)}
                      disabled={uploading}
                      id="folder-upload"
                    />
                    <Button
                      size="sm"
                      disabled={uploading}
                      onClick={() => setShowUploadModal(true)}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Batch Action Toolbar */}
                {selectedDocIds.size > 0 && (
                  <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {selectedDocIds.size} document
                        {selectedDocIds.size > 1 ? 's' : ''} sélectionné
                        {selectedDocIds.size > 1 ? 's' : ''}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedDocIds(new Set())}
                        className="h-7 text-xs"
                      >
                        Effacer la sélection
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setShowBatchDelete(true)}
                        className="h-7 gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Supprimer la sélection
                      </Button>
                    </div>
                  </div>
                )}

                {/* Search and Filter */}
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Rechercher des documents..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select
                    value={statusFilter}
                    onValueChange={(value: any) => setStatusFilter(value)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="COMPLETED">Terminé</SelectItem>
                      <SelectItem value="PROCESSING">En traitement</SelectItem>
                      <SelectItem value="PENDING">En attente</SelectItem>
                      <SelectItem value="FAILED">Échoué</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Documents Table */}
              <div className="overflow-x-auto">
                {filteredAndSortedDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Aucun document ne correspond à vos filtres'
                        : 'Aucun document pour le moment'}
                    </p>
                    {!searchQuery && statusFilter === 'all' && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Glissez-déposez des fichiers ici ou utilisez le bouton
                        de téléversement
                      </p>
                    )}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">
                          <Checkbox
                            checked={
                              selectedDocIds.size ===
                                filteredAndSortedDocuments.length &&
                              filteredAndSortedDocuments.length > 0
                            }
                            onCheckedChange={() =>
                              toggleSelectAll(filteredAndSortedDocuments)
                            }
                          />
                        </TableHead>
                        <TableHead className="w-[40px]">Statut</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8"
                            onClick={() => handleSort('name')}
                          >
                            Nom
                            {sortBy === 'name' &&
                              (sortOrder === 'asc' ? (
                                <ChevronUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ChevronDown className="ml-1 h-3 w-3" />
                              ))}
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8"
                            onClick={() => handleSort('size')}
                          >
                            Taille
                            {sortBy === 'size' &&
                              (sortOrder === 'asc' ? (
                                <ChevronUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ChevronDown className="ml-1 h-3 w-3" />
                              ))}
                          </Button>
                        </TableHead>
                        <TableHead>Téléversé par</TableHead>
                        <TableHead>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8"
                            onClick={() => handleSort('date')}
                          >
                            Date
                            {sortBy === 'date' &&
                              (sortOrder === 'asc' ? (
                                <ChevronUp className="ml-1 h-3 w-3" />
                              ) : (
                                <ChevronDown className="ml-1 h-3 w-3" />
                              ))}
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Fragments</TableHead>
                        <TableHead className="w-[100px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedDocuments.map((doc) => (
                        <TableRow
                          key={doc.id}
                          className="group cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewDocument(doc.id)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedDocIds.has(doc.id)}
                              onCheckedChange={() =>
                                toggleDocumentSelection(doc.id)
                              }
                            />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {getStatusBadge(doc.status)}
                          </TableCell>
                          <TableCell>
                            {getFileIcon(doc.mimeType, doc.originalName)}
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[400px]">
                              <p
                                className="font-medium truncate"
                                title={doc.originalName}
                              >
                                {doc.originalName}
                              </p>
                              {doc.status === 'FAILED' && (
                                <p
                                  className="text-xs text-red-600 mt-1 line-clamp-1"
                                  title={
                                    doc.processingError || 'Processing failed'
                                  }
                                >
                                  ⚠{' '}
                                  {doc.processingError || 'Processing failed'}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatBytes(doc.fileSize)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage
                                  src={doc.uploadedBy.image || undefined}
                                  alt={
                                    doc.uploadedBy.name || doc.uploadedBy.email
                                  }
                                />
                                <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                                  {(doc.uploadedBy.name || doc.uploadedBy.email)
                                    .charAt(0)
                                    .toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">
                                  {doc.uploadedBy.name || 'Unknown'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {doc.uploadedBy.email}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDistanceToNow(new Date(doc.createdAt), {
                              addSuffix: true,
                              locale: fr,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {doc.totalChunks || 0}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleViewDocument(doc.id)
                                }}
                                title="View/Download"
                                className="h-8 w-8 p-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setDeleteDocId(doc.id)
                                }}
                                title="Delete"
                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {hasMore && (
                        <TableRow>
                          <TableCell colSpan={9} className="h-24">
                            <div
                              ref={observerTarget}
                              className="flex flex-col items-center justify-center py-4 gap-3"
                            >
                              {isLoadingMore ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-sm">
                                    Loading more...
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <div className="text-sm text-muted-foreground">
                                    {allFilteredAndSorted.length -
                                      displayedCount}{' '}
                                    more documents
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      setDisplayedCount((prev) => prev + 20)
                                    }
                                    className="gap-2"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                    Load More
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Delete Dialog */}
        <AlertDialog
          open={!!deleteDocId}
          onOpenChange={() => setDeleteDocId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Document</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this document? This action
                cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDocument}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Batch Delete Dialog */}
        <AlertDialog open={showBatchDelete} onOpenChange={setShowBatchDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Multiple Documents</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedDocIds.size} document
                {selectedDocIds.size > 1 ? 's' : ''}? This action cannot be
                undone and will remove the documents from both storage and the
                vector database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBatchDelete}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete {selectedDocIds.size} Document
                {selectedDocIds.size > 1 ? 's' : ''}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Upload Choice Dialog */}
        <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Téléverser des documents</DialogTitle>
              <DialogDescription>
                Choisissez ce que vous souhaitez téléverser
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <label
                htmlFor="file-upload"
                onClick={() => setShowUploadModal(false)}
              >
                <div className="cursor-pointer group">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary hover:bg-primary/5 transition-all">
                    <FileText className="h-12 w-12 mx-auto text-gray-400 group-hover:text-primary mb-3" />
                    <h3 className="font-semibold text-sm mb-1">Fichiers</h3>
                    <p className="text-xs text-muted-foreground">
                      Sélectionner des fichiers
                    </p>
                  </div>
                </div>
              </label>
              <label
                htmlFor="folder-upload"
                onClick={() => setShowUploadModal(false)}
              >
                <div className="cursor-pointer group">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary hover:bg-primary/5 transition-all">
                    <FolderUp className="h-12 w-12 mx-auto text-gray-400 group-hover:text-primary mb-3" />
                    <h3 className="font-semibold text-sm mb-1">Dossier</h3>
                    <p className="text-xs text-muted-foreground">
                      Sélectionner un dossier entier
                    </p>
                  </div>
                </div>
              </label>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
