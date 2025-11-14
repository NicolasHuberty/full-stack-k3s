import { prisma } from '@/lib/prisma'
import { createAgentGraph } from './graph'
import type { AgentState, DocumentChunk } from './types'

export class AgentService {
  async executeAgent(
    agentId: string,
    query: string,
    userId: string,
    collectionId: string,
    actionState?: Record<string, unknown>,
    sessionId?: string
  ): Promise<{
    answer: string
    sources: Array<{
      documentId: string
      documentName: string
      content: string
      score: number
      justification?: string
    }>
    inputTokens: number
    outputTokens: number
  }> {
    try {
      // Get agent configuration
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        include: {
          actions: true,
        },
      })

      if (!agent) {
        throw new Error('Agent not found')
      }

      // Get collection agent settings
      const collectionAgent = await prisma.collectionAgent.findUnique({
        where: {
          collectionId_agentId: {
            collectionId,
            agentId,
          },
        },
      })

      // Merge action state
      const finalActionState = {
        ...(collectionAgent?.actionState as Record<string, unknown>),
        ...actionState,
      }

      // Extract modes from action state
      const translatorMode = finalActionState.translator_mode === true
      const smartMode = finalActionState.smart_mode === true
      const multilingual = translatorMode // For backward compatibility
      const reflexion = smartMode // For backward compatibility

      // Create initial state
      const initialState: AgentState = {
        query,
        userId,
        collectionId,
        sessionId,
        reflexion,
        multilingual,
        translatorMode,
        smartMode,
        retrievedDocs: [],
        relevantDocs: [],
        answer: '',
        inputTokens: 0,
        outputTokens: 0,
      }

      // Execute LangGraph workflow
      const graph = createAgentGraph()
      const result = await graph.invoke(initialState)

      // Get unique document filenames from sources
      const documentFilenames = Array.from(
        new Set(
          result.relevantDocs.map((doc: DocumentChunk) => doc.metadata.source)
        )
      )

      // Lookup document IDs by filename
      const documents = await prisma.document.findMany({
        where: {
          filename: { in: documentFilenames as string[] },
          collectionId,
        },
        select: {
          id: true,
          filename: true,
          originalName: true,
        },
      })

      const filenameToDocMap = new Map(
        documents.map((d) => [
          d.filename,
          { id: d.id, originalName: d.originalName },
        ])
      )

      // Build sources from relevant documents with proper format for frontend
      const sources = result.relevantDocs.map((doc: DocumentChunk) => {
        const docInfo = filenameToDocMap.get(doc.metadata.source)
        return {
          documentId: docInfo?.id || '',
          documentName: docInfo?.originalName || doc.metadata.title,
          content: doc.pageContent,
          score: doc.metadata.pertinenceScore || doc.metadata.similarity || 0,
          justification: doc.metadata.justification,
        }
      })

      return {
        answer: result.answer,
        sources,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
    } catch (error) {
      console.error('Agent execution failed:', error)
      throw error
    }
  }

  async getMarketplaceAgents(_userId: string) {
    return prisma.agent.findMany({
      where: {
        OR: [
          { isPublic: true, status: 'PUBLISHED' },
          // Add user-created agents if we add that feature
        ],
      },
      include: {
        actions: {
          orderBy: { order: 'asc' },
        },
        _count: {
          select: {
            collectionAgents: true,
          },
        },
      },
      orderBy: [
        { featured: 'desc' },
        { installCount: 'desc' },
        { createdAt: 'desc' },
      ],
    })
  }

  async getCollectionAgents(collectionId: string) {
    return prisma.collectionAgent.findMany({
      where: { collectionId },
      include: {
        agent: {
          include: {
            actions: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })
  }

  async activateAgent(
    collectionId: string,
    agentId: string,
    actionState?: Record<string, unknown>
  ) {
    // Check if already activated
    const existing = await prisma.collectionAgent.findUnique({
      where: {
        collectionId_agentId: {
          collectionId,
          agentId,
        },
      },
    })

    if (existing) {
      // Update action state
      return prisma.collectionAgent.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          actionState: actionState
            ? JSON.parse(JSON.stringify(actionState))
            : existing.actionState,
        },
      })
    }

    // Create new activation
    const collectionAgent = await prisma.collectionAgent.create({
      data: {
        collectionId,
        agentId,
        isActive: true,
        actionState: actionState
          ? JSON.parse(JSON.stringify(actionState))
          : undefined,
      },
    })

    // Increment install count
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        installCount: { increment: 1 },
      },
    })

    return collectionAgent
  }

  async deactivateAgent(collectionId: string, agentId: string) {
    const collectionAgent = await prisma.collectionAgent.findUnique({
      where: {
        collectionId_agentId: {
          collectionId,
          agentId,
        },
      },
    })

    if (!collectionAgent) {
      throw new Error('Agent not activated for this collection')
    }

    return prisma.collectionAgent.update({
      where: { id: collectionAgent.id },
      data: { isActive: false },
    })
  }

  async updateAgentActionState(
    collectionId: string,
    agentId: string,
    actionState: Record<string, unknown>
  ) {
    const collectionAgent = await prisma.collectionAgent.findUnique({
      where: {
        collectionId_agentId: {
          collectionId,
          agentId,
        },
      },
    })

    if (!collectionAgent) {
      throw new Error('Agent not activated for this collection')
    }

    return prisma.collectionAgent.update({
      where: { id: collectionAgent.id },
      data: {
        actionState: JSON.parse(JSON.stringify(actionState)),
      },
    })
  }
}

export function getAgentService(): AgentService {
  return new AgentService()
}
