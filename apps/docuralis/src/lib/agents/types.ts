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
