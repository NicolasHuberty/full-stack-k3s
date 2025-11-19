import { prisma } from '@/lib/prisma'
import { createAgentGraph } from './graph'
import type { AgentState, DocumentChunk } from './types'

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'docuralis'

export class AgentService {
  async executeAgent(
    agentId: string,
    query: string,
    userId: string,
    collectionId: string,
    actionState?: Record<string, unknown>,
    sessionId?: string,
    onProgress?: (event: {
      type: 'decompose' | 'retrieve' | 'grade' | 'generate' | 'complete'
      data?: any
    }) => void
  ): Promise<{
    answer: string
    sources: Array<{
      documentId: string
      documentName: string
      documentUrl?: string | null
      collectionId: string
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

      // Execute LangGraph workflow with streaming
      const graph = createAgentGraph()

      // Use streaming to get intermediate steps
      let result: AgentState | undefined
      const streamEvents: Array<{ node: string; data: any }> = []

      console.log('[Agent] Starting graph stream with initial state')
      const stream = await graph.stream(initialState, {
        streamMode: 'updates' // Explicitly request updates mode
      })

      for await (const event of stream) {
        // Track which node executed
        const nodeName = Object.keys(event)[0]
        const nodeData = event[nodeName]

        console.log(`[Agent] ========================================`)
        console.log(`[Agent] Node executed: "${nodeName}"`)
        console.log(`[Agent] Has onProgress callback: ${!!onProgress}`)
        console.log(`[Agent] nodeData keys:`, Object.keys(nodeData || {}))

        streamEvents.push({ node: nodeName, data: nodeData })

        // Emit progress events to callback
        if (nodeName === 'decompose' && nodeData?.subQueries) {
          console.log(`[Agent] ✅ MATCH: decompose with ${nodeData.subQueries.length} subQueries`)
          try {
            await onProgress?.({
              type: 'decompose',
              data: {
                subQueries: nodeData.subQueries,
                message: `Décomposition de la question en ${nodeData.subQueries.length} sous-questions`,
              },
            })
            console.log('[Agent] ✅ Decompose event sent successfully')
          } catch (e) {
            console.error('[Agent] ❌ Error sending decompose event:', e)
          }
        } else if (nodeName === 'retrieve' && nodeData?.retrievedDocs) {
          console.log(`[Agent] ✅ MATCH: retrieve with ${nodeData.retrievedDocs.length} docs`)
          try {
            await onProgress?.({
              type: 'retrieve',
              data: {
                count: nodeData.retrievedDocs.length,
                message: `Récupération de ${nodeData.retrievedDocs.length} documents pertinents`,
              },
            })
            console.log('[Agent] ✅ Retrieve event sent successfully')
          } catch (e) {
            console.error('[Agent] ❌ Error sending retrieve event:', e)
          }
        } else if (
          (nodeName === 'gradeReflexion' || nodeName === 'gradeClassical') &&
          nodeData?.relevantDocs
        ) {
          console.log(`[Agent] ✅ MATCH: ${nodeName} with ${nodeData.relevantDocs.length} docs`)
          try {
            await onProgress?.({
              type: 'grade',
              data: {
                count: nodeData.relevantDocs.length,
                message: `Analyse de la pertinence : ${nodeData.relevantDocs.length} documents retenus`,
                documents: nodeData.relevantDocs.map((d: any) => ({
                  title: d.metadata.title,
                  score: d.metadata.pertinenceScore || d.metadata.similarity,
                  justification: d.metadata.justification,
                })),
              },
            })
            console.log('[Agent] ✅ Grade event sent successfully')
          } catch (e) {
            console.error('[Agent] ❌ Error sending grade event:', e)
          }
        } else if (nodeName === 'generate' && nodeData?.answer) {
          console.log('[Agent] ✅ MATCH: generate with answer')
          try {
            await onProgress?.({
              type: 'generate',
              data: {
                message: 'Génération de la réponse finale...',
              },
            })
            console.log('[Agent] ✅ Generate event sent successfully')
          } catch (e) {
            console.error('[Agent] ❌ Error sending generate event:', e)
          }
        } else {
          console.log(`[Agent] ⚠️  NO MATCH for node "${nodeName}"`)
          console.log(`[Agent]   - nodeData?.subQueries exists: ${!!nodeData?.subQueries}`)
          console.log(`[Agent]   - nodeData?.retrievedDocs exists: ${!!nodeData?.retrievedDocs}`)
          console.log(`[Agent]   - nodeData?.relevantDocs exists: ${!!nodeData?.relevantDocs}`)
          console.log(`[Agent]   - nodeData?.answer exists: ${!!nodeData?.answer}`)
          if (nodeData) {
            console.log(`[Agent]   - nodeData sample:`, JSON.stringify(nodeData).substring(0, 300))
          }
        }

        result = { ...result, ...nodeData } as AgentState
      }

      if (!result) {
        throw new Error('No result from agent execution')
      }

      // Get unique document IDs and filenames from sources
      const documentIds = new Set<string>()
      const documentFilenames = new Set<string>()

      result.relevantDocs.forEach((doc: DocumentChunk) => {
        // Prefer documentId if available
        if (doc.metadata.documentId) {
          documentIds.add(doc.metadata.documentId)
        } else {
          // Fallback to filename extraction
          const source = doc.metadata.source
          const cleanFilename = source.split('?')[0]
          documentFilenames.add(cleanFilename)
        }
      })

      // Lookup documents by ID first, then by filename
      const documents = await prisma.document.findMany({
        where: {
          collectionId,
          OR: [
            // Direct ID lookup (most reliable)
            ...(documentIds.size > 0
              ? [{ id: { in: Array.from(documentIds) } }]
              : []),
            // Filename lookups (fallback)
            ...(documentFilenames.size > 0
              ? [
                  // Try exact match on filename
                  { filename: { in: Array.from(documentFilenames) } },
                  // Try with collection prefix (MinIO path format)
                  {
                    filename: {
                      in: Array.from(documentFilenames).map(
                        (f) => `${collectionId}/${f}`
                      ),
                    },
                  },
                  // Try originalName match as fallback
                  { originalName: { in: Array.from(documentFilenames) } },
                  // Try filename ending with the document name
                  ...Array.from(documentFilenames).map((f) => ({
                    filename: { endsWith: `/${f}` },
                  })),
                ]
              : []),
          ],
        },
        select: {
          id: true,
          filename: true,
          originalName: true,
        },
      })

  

      // Create multiple mappings for flexible lookup
      const filenameToDocMap = new Map<string, { id: string; originalName: string; filename: string }>()

      documents.forEach((d) => {
        const docData = { id: d.id, originalName: d.originalName, filename: d.filename }

        // Map by full filename
        filenameToDocMap.set(d.filename, docData)

        // Map by filename without path and query params
        const baseFilename = d.filename.split('/').pop()?.split('?')[0]
        if (baseFilename) {
          filenameToDocMap.set(baseFilename, docData)
        }

        // Map by filename without query params only
        const filenameWithoutQuery = d.filename.split('?')[0]
        if (filenameWithoutQuery !== d.filename) {
          filenameToDocMap.set(filenameWithoutQuery, docData)
        }

        // Map by originalName (CRITICAL for migrated docs)
        if (d.originalName) {
          filenameToDocMap.set(d.originalName, docData)
          // Also map originalName without extension
          const nameWithoutExt = d.originalName.replace(/\.[^/.]+$/, '')
          filenameToDocMap.set(nameWithoutExt, docData)
        }
      })

      // Build sources from relevant documents with proper format for frontend
      const sources = result.relevantDocs.map((doc: DocumentChunk, index: number) => {
        // First check if we have documentId in metadata (new approach)
        if (doc.metadata.documentId) {
          // We have the document ID directly from the vector search
          const docInfo = documents.find((d) => d.id === doc.metadata.documentId)

          // Build MinIO URL directly
          const minioUrl = docInfo?.filename
            ? docInfo.filename.startsWith(collectionId)
              ? `https://minio.docuralis.com/${BUCKET_NAME}/${docInfo.filename}`
              : `https://minio.docuralis.com/${BUCKET_NAME}/${collectionId}/${docInfo.filename}`
            : null

          return {
            documentId: doc.metadata.documentId,
            documentName: docInfo?.originalName || doc.metadata.title || doc.metadata.source,
            documentUrl: minioUrl, // Add direct MinIO URL
            collectionId: collectionId, // Add collection ID for API calls
            content: doc.pageContent,
            score: doc.metadata.pertinenceScore || doc.metadata.similarity || 0,
            justification: doc.metadata.justification,
            pageNumber: doc.metadata.pageNumber || null, // Include page number
            metadata: {
              pageNumber: doc.metadata.pageNumber || null, // Also include in metadata for compatibility
            },
          }
        }

        // Fallback to filename lookup (old approach for backward compatibility)
        const source = doc.metadata.source
        const cleanSource = source.split('?')[0] // Remove query params
        const baseSource = cleanSource.split('/').pop() || cleanSource // Get just filename

        // Try multiple lookup strategies
        const docInfo =
          filenameToDocMap.get(source) ||
          filenameToDocMap.get(cleanSource) ||
          filenameToDocMap.get(baseSource) ||
          filenameToDocMap.get(doc.metadata.title)

        if (!docInfo) {
          console.warn(
            `[AgentService] ⚠️  Could not find document for source: "${source}" (clean: "${cleanSource}", base: "${baseSource}", title: "${doc.metadata.title}")`
          )
          console.warn(`   Available keys in map: ${Array.from(filenameToDocMap.keys()).slice(0, 5).join(', ')}...`)

          // For migrated documents without DB records, try to construct MinIO URL from source
          let fallbackUrl = null
          if (baseSource && !baseSource.includes('Unknown')) {
            // Try to construct MinIO URL from the source filename
            fallbackUrl = `https://minio.docuralis.com/${BUCKET_NAME}/${collectionId}/${baseSource}`
          }

          // Generate a fallback ID that's unique but indicates migration
          const fallbackId = `migrated_${index}_${Date.now()}`
          return {
            documentId: fallbackId,
            documentName: doc.metadata.title || baseSource,
            documentUrl: fallbackUrl, // Add fallback URL
            collectionId: collectionId, // Add collection ID for API calls
            content: doc.pageContent,
            score: doc.metadata.pertinenceScore || doc.metadata.similarity || 0,
            justification: doc.metadata.justification,
            pageNumber: doc.metadata.pageNumber || null, // Include page number
            metadata: {
              pageNumber: doc.metadata.pageNumber || null, // Also include in metadata for compatibility
            },
          }
        }

        // Build MinIO URL for found document
        // The filename might already include the path, so check if it starts with collectionId
        const minioUrl = docInfo.filename
          ? docInfo.filename.startsWith(collectionId)
            ? `https://minio.docuralis.com/${BUCKET_NAME}/${docInfo.filename}`
            : `https://minio.docuralis.com/${BUCKET_NAME}/${collectionId}/${docInfo.filename}`
          : null

        return {
          documentId: docInfo.id,
          documentName: docInfo.originalName || doc.metadata.title,
          documentUrl: minioUrl, // Add direct MinIO URL
          collectionId: collectionId, // Add collection ID for API calls
          content: doc.pageContent,
          score: doc.metadata.pertinenceScore || doc.metadata.similarity || 0,
          justification: doc.metadata.justification,
          pageNumber: doc.metadata.pageNumber || null, // Include page number
          metadata: {
            pageNumber: doc.metadata.pageNumber || null, // Also include in metadata for compatibility
          },
        }
      })


      const missingDocs = sources.filter((s) => !s.documentId)
      if (missingDocs.length > 0) {
        console.warn(
          `[AgentService] ⚠️  ${missingDocs.length} sources have missing documentId`
        )
      }

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
