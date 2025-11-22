'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import * as Icons from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface AgentAction {
  id: string
  name: string
  label: string
  icon: string
  type: 'TOGGLE' | 'SELECT' | 'INPUT'
  defaultValue?: string
}

interface Agent {
  id: string
  name: string
  icon?: string
  actions: AgentAction[]
}

interface LLMModel {
  id: string
  name: string
  displayName: string
  provider: string
  isDefault: boolean
}

interface AgentActionsProps {
  collectionId: string
  onAgentChange?: (
    agentId: string | null,
    actionState: Record<string, unknown>,
    model: string
  ) => void
}

export function AgentActions({
  collectionId,
  onAgentChange,
}: AgentActionsProps) {
  const [collectionAgents, setCollectionAgents] = useState<
    Array<{
      id: string
      isActive: boolean
      actionState: Record<string, unknown>
      agent: Agent
    }>
  >([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [actionState, setActionState] = useState<Record<string, unknown>>({})
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [models, setModels] = useState<LLMModel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch models and agents, then auto-select
    const initialize = async () => {
      let defaultModelName = ''

      // Fetch models first
      try {
        const modelsResponse = await fetch('/api/models')
        if (modelsResponse.ok) {
          const modelsData = await modelsResponse.json()
          setModels(modelsData)
          const defaultModel = modelsData.find((m: LLMModel) => m.isDefault)
          if (defaultModel) {
            defaultModelName = defaultModel.name
            setSelectedModel(defaultModel.name)
          } else if (modelsData.length > 0) {
            // Fallback to first available model if no default
            defaultModelName = modelsData[0].name
            setSelectedModel(modelsData[0].name)
          }
        }
      } catch (error) {
        console.error('Failed to fetch models:', error)
      }

      // Then fetch and auto-select agents
      try {
        const agentsResponse = await fetch(
          `/api/collections/${collectionId}/agents`
        )
        if (agentsResponse.ok) {
          const agentsData = await agentsResponse.json()
          const activeAgents = agentsData.filter(
            (ca: { isActive: boolean }) => ca.isActive
          )
          setCollectionAgents(activeAgents)

          // Auto-select the first active agent if available
          if (activeAgents.length > 0) {
            const firstAgent = activeAgents[0]
            const initialActionState = firstAgent.actionState || {}

            setSelectedAgent(firstAgent.agent.id)
            setActionState(initialActionState)
            onAgentChange?.(
              firstAgent.agent.id,
              initialActionState,
              defaultModelName
            )
          } else {
            // No active agents - start with no agent (default behavior)
            setSelectedAgent(null)
            setActionState({})
            onAgentChange?.(null, {}, defaultModelName)
          }
        }
      } catch (error) {
        console.error('Failed to fetch collection agents:', error)
      } finally {
        setLoading(false)
      }
    }

    initialize()
  }, [collectionId])

  const handleAgentSelect = (agentId: string) => {
    // If clicking on the already selected agent, deselect it (use no agent)
    if (selectedAgent === agentId) {
      setSelectedAgent(null)
      setActionState({})
      onAgentChange?.(null, {}, selectedModel) // null means no agent
    } else {
      // Select the new agent
      setSelectedAgent(agentId)
      const agent = collectionAgents.find((ca) => ca.agent.id === agentId)
      if (agent) {
        setActionState(agent.actionState || {})
        onAgentChange?.(agentId, agent.actionState || {}, selectedModel)
      }
    }
  }

  const handleActionToggle = async (actionName: string) => {
    const newState = {
      ...actionState,
      [actionName]: !actionState[actionName],
    }
    setActionState(newState)
    onAgentChange?.(selectedAgent, newState, selectedModel)

    // Update backend
    if (selectedAgent) {
      try {
        await fetch(
          `/api/collections/${collectionId}/agents/${selectedAgent}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actionState: newState }),
          }
        )
      } catch (error) {
        console.error('Failed to update action state:', error)
      }
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
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <Icons.Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading agents...</span>
      </div>
    )
  }



  const activeAgent = collectionAgents.find(
    (ca) => ca.agent.id === selectedAgent
  )

  return (
    <div className="border-b bg-muted/30 px-4 py-3">
      <div className="flex items-center gap-3 flex-wrap">
        {/* Agent Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Agent:
          </span>
          <div className="flex gap-1">
            {/* No Agent / Default option */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedAgent === null ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setSelectedAgent(null)
                      setActionState({})
                      onAgentChange?.(null, {}, selectedModel)
                    }}
                    className="h-8 px-2"
                  >
                    <Icons.MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>No Agent (Default Chat)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Agent options */}
            {collectionAgents.map((ca) => {
              const AgentIcon = getIcon(ca.agent.icon)
              const isSelected = ca.agent.id === selectedAgent

              return (
                <TooltipProvider key={ca.agent.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleAgentSelect(ca.agent.id)}
                        className="h-8 px-2"
                      >
                        <AgentIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{ca.agent.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )
            })}
          </div>
        </div>

        {/* Model Selector */}
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Model:
          </span>
          <Select
            value={selectedModel}
            onValueChange={(value) => {
              setSelectedModel(value)
              onAgentChange?.(selectedAgent, actionState, value)
            }}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.name}
                  className="text-xs"
                >
                  {model.displayName}
                  {model.isDefault && (
                    <Badge variant="outline" className="ml-2 text-[10px]">
                      Default
                    </Badge>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        {activeAgent && activeAgent.agent.actions.length > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-2">
              {activeAgent.agent.actions.map((action) => {
                const ActionIcon = getIcon(action.icon)
                const isActive = actionState[action.name] === true

                return (
                  <TooltipProvider key={action.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isActive ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleActionToggle(action.name)}
                          className="h-8 px-2 gap-1"
                        >
                          <ActionIcon className="h-3.5 w-3.5" />
                          <span className="text-xs">{action.label}</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {isActive ? 'Disable' : 'Enable'} {action.label}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          </>
        )}

        {/* Status indicator */}
        <div className="ml-auto flex items-center gap-2">
          <Badge
            variant={selectedAgent ? 'default' : 'secondary'}
            className="text-xs"
          >
            {selectedAgent
              ? `Using: ${activeAgent?.agent.name || 'Agent'}`
              : 'Default Chat (No Agent)'}
          </Badge>
        </div>
      </div>
    </div>
  )
}
