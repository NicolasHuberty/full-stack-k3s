export interface AgentState {
  query: string
  userId: string
  collectionId: string
  sessionId?: string

  // Modes
  reflexion: boolean
  multilingual: boolean
  translatorMode: boolean
  smartMode: boolean

  // Processing
  subQueries?: string[]
  retrievedDocs: Array<{
    pageContent: string
    metadata: {
      title: string
      source: string
      pageNumber: number
      similarity: number
      justification?: string
      pertinenceScore?: number
      documentId?: string
    }
  }>

  relevantDocs: Array<{
    pageContent: string
    metadata: {
      title: string
      source: string
      pageNumber: number
      similarity: number
      justification?: string
      pertinenceScore?: number
      documentId?: string
    }
  }>

  // Response
  answer: string

  // Metadata
  error?: string
  inputTokens: number
  outputTokens: number
}

export interface AgentConfig {
  agentId: string
  model: string
  temperature: number
  embeddingModel: string
  systemPrompt?: string
  graphConfig?: Record<string, unknown>
}

export interface DocumentChunk {
  pageContent: string
  metadata: {
    title: string
    source: string
    pageNumber: number
    similarity: number
    justification?: string
    pertinenceScore?: number
    documentId?: string
  }
}

export interface GradingResult {
  pertinence: 'oui' | 'non'
  justification?: string
}

export interface ReflexionGradingResult {
  pertinenceScore: number
  justification: string
}

export interface ToolCallInfo {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  startedAt?: string
  completedAt?: string
  durationMs?: number
  args?: Record<string, unknown>
  resultSummary?: string
  error?: string
}
