import { StateGraph, END, START } from '@langchain/langgraph'
import type { JuportalAgentState } from './juportal-nodes'
import { searchJuportal, generateJuportalResponse } from './juportal-nodes'

export function createJuportalAgentGraph() {
  const workflow = new StateGraph<JuportalAgentState>({
    channels: {
      query: null,
      userId: null,
      sessionId: null,
      toolCalls: null,
      jurisprudence: null,
      answer: null,
      error: null,
      inputTokens: null,
      outputTokens: null,
    },
  })

  // Add nodes
  workflow.addNode('search', searchJuportal)
  workflow.addNode('generate', generateJuportalResponse)

  // Simple linear flow: START -> search -> generate -> END
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge(START, 'search' as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('search' as any, 'generate' as any)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('generate' as any, END)

  return workflow.compile()
}
