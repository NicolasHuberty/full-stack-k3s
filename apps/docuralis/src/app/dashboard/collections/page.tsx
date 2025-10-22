'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Plus, Database, X } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatBytes } from '@/lib/utils/format'

export default function CollectionsPage() {
  const t = useTranslations('collections')
  const router = useRouter()
  const [collections, setCollections] = useState<any[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [collectionName, setCollectionName] = useState('')
  const [collectionDescription, setCollectionDescription] = useState('')
  const [collectionVisibility, setCollectionVisibility] = useState<'PRIVATE' | 'ORGANIZATION' | 'PUBLIC'>('PRIVATE')

  useEffect(() => {
    fetchCollections()
  }, [])

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections')
      if (res.ok) {
        const data = await res.json()
        setCollections(data.collections)
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    }
  }

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: collectionName,
          description: collectionDescription,
          visibility: collectionVisibility,
        }),
      })

      if (res.ok) {
        setMessage({ type: 'success', text: t('createSuccess') })
        setShowCreateModal(false)
        setCollectionName('')
        setCollectionDescription('')
        setCollectionVisibility('PRIVATE')
        await fetchCollections()
      } else {
        const error = await res.json()
        setMessage({ type: 'error', text: error.error || t('createError') })
      }
    } catch (error) {
      setMessage({ type: 'error', text: t('createError') })
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{t('title')}</h1>
            <p className="text-muted-foreground">{t('description')}</p>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('createNew')}
          </Button>
        </div>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
            {message.text}
          </div>
        )}

        {collections.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Database className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t('noCollections')}</h2>
            <p className="text-muted-foreground mb-6">{t('noCollectionsDesc')}</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createFirst')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="rounded-xl border border-border bg-card p-6 hover:shadow-md transition cursor-pointer"
                onClick={() => router.push(`/dashboard/collections/${collection.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Database className="h-6 w-6 text-primary" />
                  </div>
                  <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                    {collection.visibility}
                  </span>
                </div>
                <h3 className="font-semibold text-lg mb-2">{collection.name}</h3>
                {collection.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {collection.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{collection.documentCount || 0} {t('documents')}</span>
                  <span>{formatBytes(collection.storageUsed)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Collection Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-card rounded-xl max-w-md w-full border border-border">
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="text-xl font-semibold">{t('createNew')}</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateCollection} className="p-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="collectionName">{t('name')}</Label>
                    <Input
                      id="collectionName"
                      value={collectionName}
                      onChange={(e) => setCollectionName(e.target.value)}
                      placeholder={t('namePlaceholder')}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="collectionDescription">{t('descriptionOptional')}</Label>
                    <Textarea
                      id="collectionDescription"
                      value={collectionDescription}
                      onChange={(e) => setCollectionDescription(e.target.value)}
                      placeholder={t('descriptionPlaceholder')}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="collectionVisibility">{t('visibility')}</Label>
                    <Select
                      value={collectionVisibility}
                      onValueChange={(value: any) => setCollectionVisibility(value)}
                    >
                      <SelectTrigger id="collectionVisibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PRIVATE">{t('visibilityPrivate')}</SelectItem>
                        <SelectItem value="ORGANIZATION">{t('visibilityOrganization')}</SelectItem>
                        <SelectItem value="PUBLIC">{t('visibilityPublic')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {message && (
                  <div className={`mt-4 p-3 rounded-lg text-sm ${
                    message.type === 'success' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                  }`}>
                    {message.text}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1"
                  >
                    {t('cancel')}
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? t('creating') : t('create')}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
