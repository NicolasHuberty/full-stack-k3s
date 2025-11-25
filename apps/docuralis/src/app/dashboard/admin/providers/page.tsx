'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
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
import * as Icons from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface LLMProvider {
  id: string
  name: string
  displayName: string
  baseUrl?: string
  apiKey?: string
  description?: string
  logoUrl?: string
  isActive: boolean
  modelCount?: number
  createdAt: string
}

export default function AdminProvidersPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [providers, setProviders] = useState<LLMProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProvider, setEditingProvider] = useState<LLMProvider | null>(
    null
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deletingProviderId, setDeletingProviderId] = useState<string | null>(
    null
  )

  useEffect(() => {
    fetchProviders()
  }, [])

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/admin/providers')
      if (response.ok) {
        const data = await response.json()
        setProviders(data)
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (provider: Partial<LLMProvider>) => {
    try {
      const url = provider.id
        ? `/api/admin/providers/${provider.id}`
        : '/api/admin/providers'
      const method = provider.id ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider),
      })

      if (response.ok) {
        fetchProviders()
        setIsDialogOpen(false)
        setEditingProvider(null)
        toast({
          title: 'Success',
          description: `Provider ${provider.id ? 'updated' : 'created'} successfully`,
        })
      } else {
        // Parse error response
        const errorData = await response.json()
        const errorMessage =
          errorData.error || 'Failed to save provider. Please try again.'

        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
        console.error('Failed to save provider:', errorData)
      }
    } catch (error) {
      console.error('Failed to save provider:', error)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeletingProviderId(id)
  }

  const handleConfirmDelete = async () => {
    if (!deletingProviderId) return

    try {
      const response = await fetch(
        `/api/admin/providers/${deletingProviderId}`,
        {
          method: 'DELETE',
        }
      )

      if (response.ok) {
        fetchProviders()
      }
    } catch (error) {
      console.error('Failed to delete provider:', error)
    } finally {
      setDeletingProviderId(null)
    }
  }

  const handleToggleActive = async (provider: LLMProvider) => {
    try {
      const response = await fetch(`/api/admin/providers/${provider.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !provider.isActive }),
      })

      if (response.ok) {
        fetchProviders()
      }
    } catch (error) {
      console.error('Failed to toggle provider:', error)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Icons.Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">LLM Providers</h1>
            <p className="text-muted-foreground">
              Manage AI model providers and their configurations
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingProvider(null)}>
                <Icons.Plus className="h-4 w-4 mr-2" />
                Add Provider
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingProvider ? 'Edit Provider' : 'Add New Provider'}
                </DialogTitle>
                <DialogDescription>
                  Configure the LLM provider settings and API credentials
                </DialogDescription>
              </DialogHeader>
              <ProviderForm
                provider={editingProvider}
                onSave={handleSave}
                onCancel={() => {
                  setIsDialogOpen(false)
                  setEditingProvider(null)
                }}
              />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CardTitle>{provider.displayName}</CardTitle>
                      {!provider.isActive && (
                        <Badge variant="secondary">Inactive</Badge>
                      )}
                      {provider.apiKey && (
                        <Badge variant="outline">
                          <Icons.Key className="h-3 w-3 mr-1" />
                          API Key Set
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{provider.name}</CardDescription>
                    {provider.description && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {provider.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={provider.isActive}
                      onCheckedChange={() => handleToggleActive(provider)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingProvider(provider)
                        setIsDialogOpen(true)
                      }}
                    >
                      <Icons.Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/admin/providers/${provider.id}`)
                      }
                    >
                      <Icons.Eye className="h-4 w-4 mr-2" />
                      View Models
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(provider.id)}
                    >
                      <Icons.Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Models</div>
                    <div className="font-medium">
                      {provider.modelCount || 0}
                    </div>
                  </div>
                  {provider.baseUrl && (
                    <div>
                      <div className="text-muted-foreground">Base URL</div>
                      <div className="font-medium truncate">
                        {provider.baseUrl}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <AlertDialog
          open={!!deletingProviderId}
          onOpenChange={(open) => !open && setDeletingProviderId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the
                provider and all its associated models.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  )
}

function ProviderForm({
  provider,
  onSave,
  onCancel,
}: {
  provider: LLMProvider | null
  onSave: (provider: Partial<LLMProvider>) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    name: provider?.name || '',
    displayName: provider?.displayName || '',
    baseUrl: provider?.baseUrl || '',
    apiKey: provider?.apiKey || '',
    description: provider?.description || '',
    logoUrl: provider?.logoUrl || '',
    isActive: provider?.isActive ?? true,
  })

  const { toast } = useToast()
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(provider ? { ...formData, id: provider.id } : formData)
  }

  const handleTestConnection = async () => {
    // We can test if we have at least a name and API key (or if it's an existing provider)
    if (!formData.name) {
      toast({
        title: 'Error',
        description: 'Provider Name is required for testing',
        variant: 'destructive',
      })
      return
    }

    try {
      setIsTesting(true)
      let response

      if (provider?.id) {
        // For existing providers, we can use the specific endpoint
        // BUT, if the user changed the API key in the form, we should probably test with that instead.
        // To be consistent and allow testing changes before saving, let's use the new generic endpoint for everything
        // if the form has data.
        // However, the existing endpoint handles decryption of the stored key if the user didn't enter a new one.
        // So: if apiKey field is empty, use existing endpoint (uses stored key).
        // If apiKey field is NOT empty, use generic endpoint (uses new key).

        if (formData.apiKey) {
          response = await fetch('/api/admin/providers/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: formData.name,
              baseUrl: formData.baseUrl,
              apiKey: formData.apiKey,
            }),
          })
        } else {
          // Use stored key
          response = await fetch(`/api/admin/providers/${provider.id}/test`, {
            method: 'POST',
          })
        }
      } else {
        // New provider
        if (!formData.apiKey) {
          toast({
            title: 'Error',
            description: 'API Key is required for testing',
            variant: 'destructive',
          })
          setIsTesting(false)
          return
        }

        response = await fetch('/api/admin/providers/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formData.name,
            baseUrl: formData.baseUrl,
            apiKey: formData.apiKey,
          }),
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to test connection')
      }

      setTestResult({
        success: true,
        message: data.message,
      })
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: (error as Error).message,
      })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">Provider Name (ID)</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="openai"
              required
              disabled={!!provider}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Lowercase, no spaces
            </p>
          </div>
          <div>
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
              placeholder="OpenAI"
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Brief description of the provider..."
            rows={2}
          />
        </div>

        <div>
          <Label htmlFor="baseUrl">Base URL</Label>
          <Input
            id="baseUrl"
            type="url"
            value={formData.baseUrl}
            onChange={(e) =>
              setFormData({ ...formData, baseUrl: e.target.value })
            }
            placeholder="https://api.openai.com/v1"
          />
        </div>

        <div>
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={formData.apiKey}
            onChange={(e) =>
              setFormData({ ...formData, apiKey: e.target.value })
            }
            placeholder="sk-..."
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty to keep existing key
          </p>
        </div>

        <div>
          <Label htmlFor="logoUrl">Logo URL (optional)</Label>
          <Input
            id="logoUrl"
            type="url"
            value={formData.logoUrl}
            onChange={(e) =>
              setFormData({ ...formData, logoUrl: e.target.value })
            }
            placeholder="https://..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, isActive: checked })
            }
          />
          <Label htmlFor="isActive">Active</Label>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isTesting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting}
          >
            {isTesting ? (
              <>
                <Icons.Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>

          <Button type="submit" disabled={isTesting}>
            Save
          </Button>
        </div>
      </form>

      <AlertDialog
        open={!!testResult}
        onOpenChange={(open) => !open && setTestResult(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle
              className={
                testResult?.success ? 'text-green-600' : 'text-destructive'
              }
            >
              {testResult?.success
                ? 'Connection Successful'
                : 'Connection Failed'}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-wrap">
              {testResult?.message}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTestResult(null)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
