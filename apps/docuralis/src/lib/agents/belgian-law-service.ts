/**
 * Belgian Law Agent Service
 *
 * Service layer for the Belgian Law ReAct Agent
 */

import {
  createBelgianLawAgentGraph,
  createInitialState,
  BelgianLawAgentState,
  SourceReference,
} from './belgian-law-agent'

export class BelgianLawAgentService {
  async executeAgent(
    query: string,
    userId: string,
    options?: {
      collectionId?: string
      sessionId?: string
      maxIterations?: number
    },
    onProgress?: (event: {
      type: 'plan' | 'execute' | 'generate' | 'complete'
      data?: unknown
    }) => void
  ): Promise<{
    answer: string
    sources: SourceReference[]
    inputTokens: number
    outputTokens: number
  }> {
    try {
      console.log(
        `[BelgianLawAgentService] Starting Belgian Law search for user ${userId}`
      )

      // Create initial state
      const initialState = createInitialState(query, userId, {
        collectionId: options?.collectionId,
        sessionId: options?.sessionId,
        maxIterations: options?.maxIterations || 5,
      })

      // Execute the graph
      const graph = createBelgianLawAgentGraph()

      let result: BelgianLawAgentState | undefined
      const stream = await graph.stream(initialState, {
        streamMode: 'updates',
      })

      for await (const event of stream) {
        const nodeName = Object.keys(event)[0]
        const nodeData = event[nodeName]

        // Emit progress events with detailed tool information
        if (nodeName === 'plan' && nodeData?.actions) {
          try {
            const lastAction = nodeData.actions[nodeData.actions.length - 1]
            const toolName = lastAction?.tool || 'Planification'
            const toolLabels: Record<string, string> = {
              rag: '📚 Recherche dans vos documents (RAG)',
              juportal: '⚖️ Recherche de jurisprudence (JuPortal)',
              moniteur_belge: '📜 Recherche de législation (Moniteur Belge)',
              final_answer: '✍️ Génération de la réponse',
            }
            await onProgress?.({
              type: 'plan',
              data: {
                message: toolLabels[toolName] || `Action: ${toolName}`,
                thought: nodeData.thoughts?.[nodeData.thoughts.length - 1],
                action: toolName,
                reasoning: lastAction?.reasoning,
                toolCalls: nodeData.toolCalls || [],
              },
            })
          } catch (e) {
            console.error(
              '[BelgianLawAgentService] Error sending plan event:',
              e
            )
          }
        } else if (nodeName === 'execute' && nodeData?.observations) {
          try {
            const lastObservation =
              nodeData.observations[nodeData.observations.length - 1]
            const jurisprudenceCount =
              nodeData.jurisprudenceResults?.length || 0
            const legislationCount = nodeData.legislationResults?.length || 0

            // Build documents array for UI display
            const documents: Array<{
              title: string
              score?: number
              justification?: string
            }> = []

            // Add jurisprudence results
            if (nodeData.jurisprudenceResults) {
              nodeData.jurisprudenceResults
                .slice(0, 5)
                .forEach(
                  (j: {
                    ecli: string
                    courtName: string
                    decisionDate: string
                  }) => {
                    documents.push({
                      title: `${j.ecli} - ${j.courtName}`,
                      justification: `Décision du ${j.decisionDate}`,
                    })
                  }
                )
            }

            // Add legislation results
            if (nodeData.legislationResults) {
              nodeData.legislationResults
                .slice(0, 5)
                .forEach((l: { title: string; documentType: string }) => {
                  documents.push({
                    title: l.title,
                    justification: `Type: ${l.documentType}`,
                  })
                })
            }

            await onProgress?.({
              type: 'execute',
              data: {
                message: lastObservation || 'Recherche en cours...',
                observation: lastObservation,
                jurisprudenceCount,
                legislationCount,
                count: jurisprudenceCount + legislationCount,
                documents,
                toolCalls: nodeData.toolCalls || [],
              },
            })
          } catch (e) {
            console.error(
              '[BelgianLawAgentService] Error sending execute event:',
              e
            )
          }
        } else if (nodeName === 'generate' && nodeData?.answer) {
          try {
            await onProgress?.({
              type: 'generate',
              data: {
                message: '✍️ Génération de la réponse finale...',
              },
            })
          } catch (e) {
            console.error(
              '[BelgianLawAgentService] Error sending generate event:',
              e
            )
          }
        }

        result = { ...result, ...nodeData } as BelgianLawAgentState
      }

      if (!result) {
        throw new Error('No result from Belgian Law agent execution')
      }

      console.log(
        `[BelgianLawAgentService] Completed with ${result.jurisprudenceResults?.length || 0} jurisprudence, ${result.legislationResults?.length || 0} legislation`
      )

      return {
        answer: result.answer || '',
        sources: result.sources || [],
        inputTokens: result.inputTokens || 0,
        outputTokens: result.outputTokens || 0,
      }
    } catch (error) {
      console.error('[BelgianLawAgentService] Execution failed:', error)
      throw error
    }
  }
}

let belgianLawAgentService: BelgianLawAgentService | null = null

export function getBelgianLawAgentService(): BelgianLawAgentService {
  if (!belgianLawAgentService) {
    belgianLawAgentService = new BelgianLawAgentService()
  }
  return belgianLawAgentService
}
