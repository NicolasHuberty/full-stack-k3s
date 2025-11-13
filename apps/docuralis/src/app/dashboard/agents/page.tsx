'use client'

import { useEffect, useState } from 'react'
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
import * as Icons from 'lucide-react'

interface AgentAction {
  id: string
  name: string
  label: string
  icon: string
  type: 'TOGGLE' | 'SELECT' | 'INPUT'
  defaultValue?: string
  options?: Record<string, unknown>
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
  actions: AgentAction[]
  _count: {
    collectionAgents: number
  }
}

export default function AgentsMarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/agents')
      if (response.ok) {
        const data = await response.json()
        setAgents(data)
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error)
    } finally {
      setLoading(false)
    }
  }

  const getIcon = (
    iconName?: string
  ): React.ComponentType<{ className?: string }> => {
    if (!iconName) return Icons.Bot
    const Icon = (Icons as Record<string, unknown>)[iconName] as
      | React.ComponentType<{ className?: string }>
      | undefined
    return Icon || Icons.Bot
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Icons.Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Loading agents...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Agent Marketplace</h1>
          <p className="text-muted-foreground">
            Browse and activate intelligent agents for your collections
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => {
            const IconComponent = getIcon(agent.icon)
            return (
              <Card key={agent.id} className="relative">
                {agent.featured && (
                  <Badge className="absolute top-4 right-4" variant="default">
                    Featured
                  </Badge>
                )}
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <IconComponent className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <CardTitle>{agent.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {agent.installCount} installations
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    {agent.description}
                  </p>

                  {agent.actions.length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs font-medium mb-2">
                        Available Actions:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {agent.actions.map((action) => {
                          const ActionIcon = getIcon(action.icon)
                          return (
                            <Badge
                              key={action.id}
                              variant="outline"
                              className="gap-1"
                            >
                              <ActionIcon className="h-3 w-3" />
                              {action.label}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <Button className="w-full" asChild>
                    <a href={`/dashboard/agents/${agent.id}`}>View Details</a>
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {agents.length === 0 && (
          <div className="text-center py-12">
            <Icons.Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No agents available</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
