import { createJuportalAgentGraph } from './juportal-graph'
import type { JuportalAgentState, JurisprudenceResult } from './juportal-nodes'

export class JuportalAgentService {
  async executeAgent(
    query: string,
    userId: string,
    sessionId?: string,
    onProgress?: (event: {
      type: 'decompose' | 'retrieve' | 'grade' | 'generate' | 'complete'
      data?: unknown
    }) => void
  ): Promise<{
    answer: string
    sources: JurisprudenceResult[]
    inputTokens: number
    outputTokens: number
  }> {
    try {
      console.log(
        `[JuportalAgentService] Starting JUPORTAL search for user ${userId}`
      )

      // Create initial state
      const initialState: JuportalAgentState = {
        query,
        userId,
        sessionId,
        toolCalls: [],
        jurisprudence: [],
        answer: '',
        inputTokens: 0,
        outputTokens: 0,
      }

      // Execute the graph
      const graph = createJuportalAgentGraph()

      let result: JuportalAgentState | undefined
      const stream = await graph.stream(initialState, {
        streamMode: 'updates',
      })

      for await (const event of stream) {
        const nodeName = Object.keys(event)[0]
        const nodeData = event[nodeName]

        // Emit progress events (using 'retrieve' type for compatibility)
        if (nodeName === 'search' && nodeData?.jurisprudence) {
          try {
            await onProgress?.({
              type: 'retrieve',
              data: {
                count: nodeData.jurisprudence.length,
                message: `Recherche JUPORTAL: ${nodeData.jurisprudence.length} décisions trouvées`,
                toolCalls: nodeData.toolCalls || [],
              },
            })
          } catch (e) {
            console.error(
              '[JuportalAgentService] Error sending search event:',
              e
            )
          }
        } else if (nodeName === 'generate' && nodeData?.answer) {
          try {
            await onProgress?.({
              type: 'generate',
              data: {
                message: 'Génération de la réponse...',
              },
            })
          } catch (e) {
            console.error(
              '[JuportalAgentService] Error sending generate event:',
              e
            )
          }
        }

        result = { ...result, ...nodeData } as JuportalAgentState
      }

      if (!result) {
        throw new Error('No result from JUPORTAL agent execution')
      }

      console.log(
        `[JuportalAgentService] Completed with ${result.jurisprudence.length} results`
      )

      return {
        answer: result.answer,
        sources: result.jurisprudence,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      }
    } catch (error) {
      console.error('[JuportalAgentService] Execution failed:', error)
      throw error
    }
  }
}

let juportalAgentService: JuportalAgentService | null = null

export function getJuportalAgentService(): JuportalAgentService {
  if (!juportalAgentService) {
    juportalAgentService = new JuportalAgentService()
  }
  return juportalAgentService
}
