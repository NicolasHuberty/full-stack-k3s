'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as Icons from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AgentActionOptions {
  [key: string]: unknown
}

interface AgentAction {
  id: string
  name: string
  label: string
  icon: string
  type: 'TOGGLE' | 'SELECT' | 'INPUT'
  defaultValue?: string
  options?: AgentActionOptions
  order: number
}

interface Agent {
  id: string
  name: string
  description: string
  icon?: string
  status: string
  featured: boolean
  installCount: number
  systemPrompt: string
  temperature: number
  model: string
  actions: AgentAction[]
}

interface Collection {
  id: string
  name: string
}

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('')
  const [actionState, setActionState] = useState<
    Record<string, boolean | string>
  >({})
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)

  const fetchAgent = useCallback(async () => {
    try {
      const response = await fetch(`/api/agents/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setAgent(data)

        // Initialize action state with defaults
        const initialState: Record<string, boolean | string> = {}
        data.actions.forEach((action: AgentAction) => {
          initialState[action.name] = action.defaultValue === 'true'
        })
        setActionState(initialState)
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections')
      if (response.ok) {
        const data = await response.json()
        setCollections(data.collections || [])
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error)
    }
  }

  useEffect(() => {
    fetchAgent()
    fetchCollections()
  }, [fetchAgent])

  const handleActivate = async () => {
    if (!selectedCollectionId) {
      toast({
        title: 'Error',
        description: 'Please select a collection',
        variant: 'destructive',
      })
      return
    }

    setActivating(true)
    try {
      const response = await fetch(
        `/api/collections/${selectedCollectionId}/agents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId: params.id,
            actionState,
          }),
        }
      )

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Agent activated for collection',
        })
        router.push(`/dashboard/collections/${selectedCollectionId}`)
      } else {
        throw new Error('Failed to activate agent')
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to activate agent',
        variant: 'destructive',
      })
    } finally {
      setActivating(false)
    }
  }

  const getIcon = (iconName?: string) => {
    if (!iconName) return Icons.Bot
    const Icon = Icons[iconName as keyof typeof Icons] as
      | React.ComponentType<{ className?: string }>
      | undefined
    return Icon || Icons.Bot
  }

  if (loading || !agent) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Icons.Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading agent...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const IconComponent = getIcon(agent.icon)

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-4">
          <Icons.ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <IconComponent className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-2xl">{agent.name}</CardTitle>
                  {agent.featured && <Badge>Featured</Badge>}
                </div>
                <CardDescription>
                  {agent.installCount} installations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Description</h3>
              <p className="text-sm text-muted-foreground">
                {agent.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Model</Label>
                <p className="text-sm font-medium">{agent.model}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">
                  Temperature
                </Label>
                <p className="text-sm font-medium">{agent.temperature}</p>
              </div>
            </div>

            {agent.actions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-4">Configure Actions</h3>
                <div className="space-y-4">
                  {agent.actions.map((action) => {
                    const ActionIcon = getIcon(action.icon)

                    if (action.type === 'TOGGLE') {
                      return (
                        <div
                          key={action.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <ActionIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <Label htmlFor={action.name}>
                                {action.label}
                              </Label>
                            </div>
                          </div>
                          <Switch
                            id={action.name}
                            checked={Boolean(actionState[action.name])}
                            onCheckedChange={(checked) =>
                              setActionState((prev) => ({
                                ...prev,
                                [action.name]: checked,
                              }))
                            }
                          />
                        </div>
                      )
                    }

                    return null
                  })}
                </div>
              </div>
            )}

            <div className="border-t pt-6">
              <h3 className="font-semibold mb-4">Activate for Collection</h3>
              <div className="space-y-4">
                <div>
                  <Label>Select Collection</Label>
                  <Select
                    value={selectedCollectionId}
                    onValueChange={setSelectedCollectionId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a collection" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((collection) => (
                        <SelectItem key={collection.id} value={collection.id}>
                          {collection.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  className="w-full"
                  onClick={handleActivate}
                  disabled={activating || !selectedCollectionId}
                >
                  {activating ? (
                    <>
                      <Icons.Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Activating...
                    </>
                  ) : (
                    <>
                      <Icons.Plus className="h-4 w-4 mr-2" />
                      Activate Agent
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
