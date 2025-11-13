import { StateGraph, END, START } from '@langchain/langgraph'
import type { AgentState } from './types'
import {
  decomposeQuery,
  retrieveDocuments,
  gradeDocumentsClassical,
  gradeDocumentsReflexion,
  generateResponse,
} from './nodes'

export function createAgentGraph() {
  const workflow = new StateGraph<AgentState>({
    channels: {
      query: null,
      userId: null,
      collectionId: null,
      sessionId: null,
      reflexion: null,
      multilingual: null,
      translatorMode: null,
      smartMode: null,
      subQueries: null,
      retrievedDocs: null,
      relevantDocs: null,
      answer: null,
      error: null,
      inputTokens: null,
      outputTokens: null,
    },
  })

  // Add nodes
  workflow.addNode('decompose', decomposeQuery)
  workflow.addNode('retrieve', retrieveDocuments)
  workflow.addNode('gradeClassical', gradeDocumentsClassical)
  workflow.addNode('gradeReflexion', gradeDocumentsReflexion)
  workflow.addNode('generate', generateResponse)

  // Add conditional edge from START
  workflow.addConditionalEdges(START, (state: AgentState) => {
    if (state.smartMode || state.reflexion) {
      return 'decompose'
    }
    return 'retrieve'
  })

  // From decompose, always go to retrieve
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('decompose' as any, 'retrieve')

  // From retrieve, route to appropriate grading
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addConditionalEdges('retrieve' as any, (state: AgentState) => {
    if (state.smartMode || state.reflexion) {
      return 'gradeReflexion'
    }
    return 'gradeClassical'
  })

  // Both grading nodes go to generate
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('gradeClassical' as any, 'generate')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('gradeReflexion' as any, 'generate')

  // Generate goes to END
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('generate' as any, END)

  return workflow.compile()
}
