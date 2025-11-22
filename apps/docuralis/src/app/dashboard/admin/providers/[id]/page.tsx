'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

interface LLMModel {
    id: string
    name: string
    displayName: string
    providerId: string
    contextWindow?: number
    maxTokens?: number
    inputPrice?: number
    outputPrice?: number
    isActive: boolean
    isDefault: boolean
    createdAt: string
}

interface LLMProvider {
    id: string
    name: string
    displayName: string
    description?: string
    models: LLMModel[]
}

export default function ProviderModelsPage() {
    const params = useParams()
    const router = useRouter()
    const providerId = params.id as string

    const [provider, setProvider] = useState<LLMProvider | null>(null)
    const [loading, setLoading] = useState(true)
    const [editingModel, setEditingModel] = useState<LLMModel | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [deletingModelId, setDeletingModelId] = useState<string | null>(null)

    useEffect(() => {
        fetchProvider()
    }, [providerId])

    const fetchProvider = async () => {
        try {
            const response = await fetch(`/api/admin/providers/${providerId}`)
            if (response.ok) {
                const data = await response.json()
                setProvider(data)
            }
        } catch (error) {
            console.error('Failed to fetch provider:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveModel = async (model: Partial<LLMModel>) => {
        try {
            const url = model.id
                ? `/api/admin/models/${model.id}`
                : '/api/admin/models'
            const method = model.id ? 'PATCH' : 'POST'

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...model, providerId }),
            })

            if (response.ok) {
                fetchProvider()
                setIsDialogOpen(false)
                setEditingModel(null)
            }
        } catch (error) {
            console.error('Failed to save model:', error)
        }
    }

    const handleDeleteClick = (id: string) => {
        setDeletingModelId(id)
    }

    const handleConfirmDelete = async () => {
        if (!deletingModelId) return

        try {
            const response = await fetch(`/api/admin/models/${deletingModelId}`, {
                method: 'DELETE',
            })

            if (response.ok) {
                fetchProvider()
            }
        } catch (error) {
            console.error('Failed to delete model:', error)
        } finally {
            setDeletingModelId(null)
        }
    }

    const handleToggleActive = async (model: LLMModel) => {
        try {
            const response = await fetch(`/api/admin/models/${model.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !model.isActive }),
            })

            if (response.ok) {
                fetchProvider()
            }
        } catch (error) {
            console.error('Failed to toggle model:', error)
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

    if (!provider) {
        return (
            <DashboardLayout>
                <div className="container mx-auto p-6">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">Provider not found</h1>
                        <Button onClick={() => router.push('/dashboard/admin/providers')} className="mt-4">
                            Back to Providers
                        </Button>
                    </div>
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6">
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => router.push('/dashboard/admin/providers')}
                        className="mb-4"
                    >
                        <Icons.ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Providers
                    </Button>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold">{provider.displayName} Models</h1>
                            <p className="text-muted-foreground">
                                {provider.description || `Manage ${provider.displayName} models`}
                            </p>
                        </div>
                        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setEditingModel(null)}>
                                    <Icons.Plus className="h-4 w-4 mr-2" />
                                    Add Model
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>
                                        {editingModel ? 'Edit Model' : 'Add New Model'}
                                    </DialogTitle>
                                    <DialogDescription>
                                        Configure the LLM model settings for {provider.displayName}
                                    </DialogDescription>
                                </DialogHeader>
                                <ModelForm
                                    model={editingModel}
                                    onSave={handleSaveModel}
                                    onCancel={() => {
                                        setIsDialogOpen(false)
                                        setEditingModel(null)
                                    }}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                <div className="grid gap-4">
                    {provider.models.length === 0 ? (
                        <Card>
                            <CardContent className="p-6 text-center text-muted-foreground">
                                No models configured for this provider yet.
                            </CardContent>
                        </Card>
                    ) : (
                        provider.models.map((model) => (
                            <Card key={model.id}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CardTitle>{model.displayName}</CardTitle>
                                                {model.isDefault && <Badge>Default</Badge>}
                                                {!model.isActive && (
                                                    <Badge variant="secondary">Inactive</Badge>
                                                )}
                                            </div>
                                            <CardDescription>{model.name}</CardDescription>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={model.isActive}
                                                onCheckedChange={() => handleToggleActive(model)}
                                            />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEditingModel(model)
                                                    setIsDialogOpen(true)
                                                }}
                                            >
                                                <Icons.Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteClick(model.id)}
                                            >
                                                <Icons.Trash className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                        {model.contextWindow && (
                                            <div>
                                                <div className="text-muted-foreground">
                                                    Context Window
                                                </div>
                                                <div className="font-medium">
                                                    {model.contextWindow.toLocaleString()}
                                                </div>
                                            </div>
                                        )}
                                        {model.maxTokens && (
                                            <div>
                                                <div className="text-muted-foreground">Max Tokens</div>
                                                <div className="font-medium">
                                                    {model.maxTokens.toLocaleString()}
                                                </div>
                                            </div>
                                        )}
                                        {model.inputPrice && (
                                            <div>
                                                <div className="text-muted-foreground">Input Price</div>
                                                <div className="font-medium">
                                                    ${model.inputPrice}/1M tokens
                                                </div>
                                            </div>
                                        )}
                                        {model.outputPrice && (
                                            <div>
                                                <div className="text-muted-foreground">Output Price</div>
                                                <div className="font-medium">
                                                    ${model.outputPrice}/1M tokens
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <AlertDialog open={!!deletingModelId} onOpenChange={(open) => !open && setDeletingModelId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the model.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </DashboardLayout>
    )
}

function ModelForm({
    model,
    onSave,
    onCancel,
}: {
    model: LLMModel | null
    onSave: (model: Partial<LLMModel>) => void
    onCancel: () => void
}) {
    const [formData, setFormData] = useState({
        name: model?.name || '',
        displayName: model?.displayName || '',
        contextWindow: model?.contextWindow || 128000,
        maxTokens: model?.maxTokens || 4096,
        inputPrice: model?.inputPrice || 0,
        outputPrice: model?.outputPrice || 0,
        isActive: model?.isActive ?? true,
        isDefault: model?.isDefault ?? false,
    })

    const [showDefaultConfirm, setShowDefaultConfirm] = useState(false)
    const [currentDefaultModelName, setCurrentDefaultModelName] = useState<string | null>(null)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        onSave(model ? { ...formData, id: model.id } : formData)
    }

    const handleDefaultChange = async (checked: boolean) => {
        if (!checked) {
            setFormData({ ...formData, isDefault: false })
            return
        }

        // If we are enabling default, check if there's already a default model
        try {
            const response = await fetch('/api/admin/models')
            if (response.ok) {
                const models: LLMModel[] = await response.json()
                const currentDefault = models.find((m) => m.isDefault)

                // If there is a default model and it's not the one we are currently editing
                if (currentDefault && currentDefault.id !== model?.id) {
                    setCurrentDefaultModelName(currentDefault.displayName || currentDefault.name)
                    setShowDefaultConfirm(true)
                    return
                }
            }
        } catch (error) {
            console.error('Failed to check default model:', error)
        }

        // If no default exists or we couldn't check, just proceed
        setFormData({ ...formData, isDefault: true })
    }

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="name">Model Name</Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="gpt-4o-mini"
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                            id="displayName"
                            value={formData.displayName}
                            onChange={(e) =>
                                setFormData({ ...formData, displayName: e.target.value })
                            }
                            placeholder="GPT-4o Mini"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="contextWindow">Context Window</Label>
                        <Input
                            id="contextWindow"
                            type="number"
                            value={formData.contextWindow}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    contextWindow: parseInt(e.target.value) || 0,
                                })
                            }
                        />
                    </div>
                    <div>
                        <Label htmlFor="maxTokens">Max Tokens</Label>
                        <Input
                            id="maxTokens"
                            type="number"
                            value={formData.maxTokens}
                            onChange={(e) =>
                                setFormData({ ...formData, maxTokens: parseInt(e.target.value) || 0 })
                            }
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="inputPrice">Input Price ($/1M tokens)</Label>
                        <Input
                            id="inputPrice"
                            type="number"
                            step="0.01"
                            value={formData.inputPrice}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    inputPrice: parseFloat(e.target.value) || 0,
                                })
                            }
                        />
                    </div>
                    <div>
                        <Label htmlFor="outputPrice">Output Price ($/1M tokens)</Label>
                        <Input
                            id="outputPrice"
                            type="number"
                            step="0.01"
                            value={formData.outputPrice}
                            onChange={(e) =>
                                setFormData({
                                    ...formData,
                                    outputPrice: parseFloat(e.target.value) || 0,
                                })
                            }
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
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
                        <div className="flex items-center gap-2">
                            <Switch
                                id="isDefault"
                                checked={formData.isDefault}
                                onCheckedChange={handleDefaultChange}
                            />
                            <Label htmlFor="isDefault">Default</Label>
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit">Save</Button>
                </div>
            </form>

            <AlertDialog open={showDefaultConfirm} onOpenChange={setShowDefaultConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change Default Model?</AlertDialogTitle>
                        <AlertDialogDescription>
                            By putting this one default you'll remove the old one ({currentDefaultModelName}) default.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setShowDefaultConfirm(false)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setFormData({ ...formData, isDefault: true })
                                setShowDefaultConfirm(false)
                            }}
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
