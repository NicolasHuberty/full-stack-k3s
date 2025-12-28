/**
 * Web Lawyer Agent (Belgian Law)
 *
 * A specialized agent for Belgian law that uses:
 * - Qdrant RAG for semantic jurisprudence search
 * - JUPORTAL web search for live court decisions
 * - Tool-based architecture with full logging
 *
 * This agent replaces the old LangGraph-based implementation.
 */

import { ChatOpenAI } from '@langchain/openai'
import { v4 as uuidv4 } from 'uuid'
import {
  executeTool,
  executeToolsParallel,
  getToolDefinitions,
  formatToolCallsForDisplay,
  JurisprudenceDocument,
  JurisprudenceSearchResult,
  ToolResult,
  ToolCall,
} from '@/lib/tools'

// Types
export interface WebLawyerState {
  sessionId: string
  query: string
  collectionId?: string
  useJuportal: boolean
  useRag: boolean
  topK: number
  language: string
  courts?: string[]
  documents: JurisprudenceDocument[]
  toolCalls: ToolCall[]
  answer?: string
  error?: string
}

export interface WebLawyerResponse {
  sessionId: string
  answer: string
  documents: JurisprudenceDocument[]
  toolCalls: Array<{
    id: string
    name: string
    status: string
    duration: string
    args: Record<string, unknown>
    resultSummary?: string
    error?: string
  }>
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

// LLM Configuration
const model = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0.1,
})

// System prompt for Belgian law analysis
const SYSTEM_PROMPT = `Tu es un expert en droit belge spécialisé dans l'analyse de jurisprudence.
Tu as accès à une base de données de décisions de justice belges (JUPORTAL) et tu dois fournir des réponses juridiques précises et bien documentées.

RÈGLES IMPORTANTES:
1. TOUJOURS citer les références ECLI des décisions utilisées
2. Mentionner le tribunal, la date et le numéro de rôle
3. Expliquer le raisonnement juridique de manière claire
4. Distinguer les différentes juridictions (Cour de cassation, Conseil d'État, Cour constitutionnelle, etc.)
5. Utiliser un langage juridique précis mais accessible

FORMAT DE RÉPONSE:
- Commence par un résumé de la question juridique
- Présente les principes juridiques applicables
- Cite les décisions pertinentes avec leurs références complètes
- Explique comment ces décisions s'appliquent au cas
- Conclus avec une synthèse

CITATIONS:
- Format: (ECLI, Tribunal, Date)
- Exemple: (ECLI:BE:CASS:2024:ARR.20240115.1, Cour de cassation, 15 janvier 2024)

Réponds toujours en français sauf si l'utilisateur demande explicitement une autre langue.`

/**
 * Format jurisprudence documents for LLM context
 */
function formatDocumentsForContext(docs: JurisprudenceDocument[]): string {
  if (docs.length === 0) {
    return 'Aucune jurisprudence trouvée.'
  }

  return docs
    .map((doc, idx) => {
      const lines = [
        `[${idx + 1}] ${doc.ecli}`,
        `    Tribunal: ${doc.courtName}`,
        `    Date: ${doc.decisionDate}`,
        doc.roleNumber ? `    N° de rôle: ${doc.roleNumber}` : '',
        doc.summary ? `    Résumé: ${doc.summary}` : '',
        doc.thesaurusCas.length > 0
          ? `    Mots-clés: ${doc.thesaurusCas.slice(0, 5).join(', ')}`
          : '',
        doc.score !== undefined
          ? `    Score: ${(doc.score * 100).toFixed(1)}%`
          : '',
        `    URL: ${doc.url}`,
      ]
      return lines.filter(Boolean).join('\n')
    })
    .join('\n\n')
}

/**
 * Analyze query to determine search strategy
 */
function analyzeQuery(query: string): {
  keywords: string[]
  suggestedCourts: string[]
  isSpecificCase: boolean
} {
  const keywords: string[] = []
  const suggestedCourts: string[] = []

  // Extract potential keywords
  const words = query.toLowerCase().split(/\s+/)
  const legalTerms = [
    'responsabilité',
    'contrat',
    'préjudice',
    'dommage',
    'faute',
    'cassation',
    'appel',
    'nullité',
    'prescription',
    'compétence',
    'recevabilité',
    'intérêt',
    'action',
    'délai',
    'procédure',
  ]

  for (const word of words) {
    if (legalTerms.some((term) => word.includes(term))) {
      keywords.push(word)
    }
  }

  // Detect court references
  if (query.includes('cassation') || query.includes('Cour de cassation')) {
    suggestedCourts.push('CASS')
  }
  if (query.includes("Conseil d'État") || query.includes('conseil état')) {
    suggestedCourts.push('RVSCE')
  }
  if (query.includes('constitutionnel')) {
    suggestedCourts.push('GHCC')
  }

  // Check if looking for a specific case (ECLI mentioned)
  const isSpecificCase = /ECLI:BE:/i.test(query)

  return { keywords, suggestedCourts, isSpecificCase }
}

/**
 * Execute the Web Lawyer agent
 */
export async function executeWebLawyer(params: {
  query: string
  sessionId?: string
  collectionId?: string
  useJuportal?: boolean
  useRag?: boolean
  topK?: number
  language?: string
  courts?: string[]
}): Promise<WebLawyerResponse> {
  const sessionId = params.sessionId || uuidv4()
  const {
    query,
    collectionId,
    useJuportal = true,
    useRag = true,
    topK = 10,
    language = 'FR',
    courts,
  } = params

  console.log('[WEB-LAWYER] Starting execution:', {
    sessionId: sessionId.slice(0, 8),
    query: query.slice(0, 100),
    useJuportal,
    useRag,
    topK,
  })

  const allDocuments: JurisprudenceDocument[] = []
  const errors: string[] = []

  // Step 1: Analyze query
  const queryAnalysis = analyzeQuery(query)
  console.log('[WEB-LAWYER] Query analysis:', queryAnalysis)

  // Step 2: Execute searches in parallel
  const searchTasks: Array<{ name: string; args: Record<string, unknown> }> = []

  if (useRag) {
    // Use collection-specific search if collectionId provided
    if (collectionId) {
      searchTasks.push({
        name: 'search_collection_jurisprudence',
        args: {
          collectionId,
          query,
          topK,
        },
      })
    } else {
      // Use global jurisprudence RAG
      searchTasks.push({
        name: 'search_jurisprudence_rag',
        args: {
          query,
          topK,
          language,
          courtCodes: courts || queryAnalysis.suggestedCourts,
          minScore: 0.5,
        },
      })
    }
  }

  if (useJuportal && !collectionId) {
    // Only use JUPORTAL for general searches (not collection-specific)
    searchTasks.push({
      name: 'search_juportal',
      args: {
        query,
        courts: courts || queryAnalysis.suggestedCourts,
        languages: [language, 'NL', 'DE'],
        limit: topK,
      },
    })
  }

  console.log(`[WEB-LAWYER] Executing ${searchTasks.length} search tools...`)

  // Execute searches
  const results = await executeToolsParallel(sessionId, searchTasks)

  // Process results
  for (const result of results) {
    if (result.success && result.data) {
      const searchResult = result.data as JurisprudenceSearchResult
      console.log(
        `[WEB-LAWYER] Got ${searchResult.documents.length} documents from ${searchResult.source}`
      )
      allDocuments.push(...searchResult.documents)
    } else if (result.error) {
      errors.push(result.error)
    }
  }

  // Step 3: Deduplicate and rank documents
  const seenEclis = new Set<string>()
  const uniqueDocuments: JurisprudenceDocument[] = []

  // Sort by score (highest first) then by date (newest first)
  const sortedDocs = [...allDocuments].sort((a, b) => {
    if (a.score !== undefined && b.score !== undefined) {
      return b.score - a.score
    }
    // Parse dates for comparison
    const dateA = a.decisionDate || ''
    const dateB = b.decisionDate || ''
    return dateB.localeCompare(dateA)
  })

  for (const doc of sortedDocs) {
    if (doc.ecli && !seenEclis.has(doc.ecli)) {
      seenEclis.add(doc.ecli)
      uniqueDocuments.push(doc)
    } else if (!doc.ecli) {
      // Keep documents without ECLI but limit them
      if (uniqueDocuments.filter((d) => !d.ecli).length < 5) {
        uniqueDocuments.push(doc)
      }
    }
  }

  const topDocuments = uniqueDocuments.slice(0, topK)
  console.log(
    `[WEB-LAWYER] Selected ${topDocuments.length} unique documents for analysis`
  )

  // Step 4: Generate legal analysis
  const context = formatDocumentsForContext(topDocuments)

  const userPrompt = `Question juridique: ${query}

Jurisprudence disponible:
${context}

Analyse cette jurisprudence et réponds à la question juridique de manière détaillée et documentée.`

  console.log('[WEB-LAWYER] Generating legal analysis...')

  const response = await model.invoke([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ])

  const answer = response.content.toString().trim()

  // Get formatted tool calls for display
  const toolCallsDisplay = formatToolCallsForDisplay(sessionId)

  console.log(
    `[WEB-LAWYER] Completed. Generated ${answer.length} char response`
  )

  return {
    sessionId,
    answer,
    documents: topDocuments,
    toolCalls: toolCallsDisplay,
    usage: {
      promptTokens: response.usage_metadata?.input_tokens || 0,
      completionTokens: response.usage_metadata?.output_tokens || 0,
      totalTokens: response.usage_metadata?.total_tokens || 0,
    },
  }
}

/**
 * Stream the Web Lawyer response
 */
export async function* streamWebLawyer(params: {
  query: string
  sessionId?: string
  collectionId?: string
  useJuportal?: boolean
  useRag?: boolean
  topK?: number
  language?: string
  courts?: string[]
}): AsyncGenerator<{
  type:
    | 'tool_start'
    | 'tool_complete'
    | 'documents'
    | 'token'
    | 'done'
    | 'error'
  data: unknown
}> {
  const sessionId = params.sessionId || uuidv4()
  const {
    query,
    collectionId,
    useJuportal = true,
    useRag = true,
    topK = 10,
    language = 'FR',
    courts,
  } = params

  console.log('[WEB-LAWYER-STREAM] Starting execution:', {
    sessionId: sessionId.slice(0, 8),
    query: query.slice(0, 100),
  })

  const allDocuments: JurisprudenceDocument[] = []

  // Step 1: Analyze query
  const queryAnalysis = analyzeQuery(query)

  // Step 2: Execute RAG search
  if (useRag) {
    yield {
      type: 'tool_start',
      data: { name: 'search_jurisprudence_rag', sessionId },
    }

    let result: ToolResult
    if (collectionId) {
      result = await executeTool(sessionId, 'search_collection_jurisprudence', {
        collectionId,
        query,
        topK,
      })
    } else {
      result = await executeTool(sessionId, 'search_jurisprudence_rag', {
        query,
        topK,
        language,
        courtCodes: courts || queryAnalysis.suggestedCourts,
        minScore: 0.5,
      })
    }

    yield {
      type: 'tool_complete',
      data: {
        name: 'search_jurisprudence_rag',
        success: result.success,
        itemCount: result.metadata?.itemCount || 0,
        durationMs: result.metadata?.durationMs,
      },
    }

    if (result.success && result.data) {
      const searchResult = result.data as JurisprudenceSearchResult
      allDocuments.push(...searchResult.documents)
    }
  }

  // Step 3: Execute JUPORTAL search
  if (useJuportal && !collectionId) {
    yield {
      type: 'tool_start',
      data: { name: 'search_juportal', sessionId },
    }

    const result = await executeTool(sessionId, 'search_juportal', {
      query,
      courts: courts || queryAnalysis.suggestedCourts,
      languages: [language, 'NL', 'DE'],
      limit: topK,
    })

    yield {
      type: 'tool_complete',
      data: {
        name: 'search_juportal',
        success: result.success,
        itemCount: result.metadata?.itemCount || 0,
        durationMs: result.metadata?.durationMs,
      },
    }

    if (result.success && result.data) {
      const searchResult = result.data as JurisprudenceSearchResult
      allDocuments.push(...searchResult.documents)
    }
  }

  // Step 4: Deduplicate and yield documents
  const seenEclis = new Set<string>()
  const uniqueDocuments: JurisprudenceDocument[] = []

  for (const doc of allDocuments) {
    if (doc.ecli && !seenEclis.has(doc.ecli)) {
      seenEclis.add(doc.ecli)
      uniqueDocuments.push(doc)
    }
  }

  const topDocuments = uniqueDocuments.slice(0, topK)

  yield {
    type: 'documents',
    data: topDocuments,
  }

  // Step 5: Stream LLM response
  const context = formatDocumentsForContext(topDocuments)

  const userPrompt = `Question juridique: ${query}

Jurisprudence disponible:
${context}

Analyse cette jurisprudence et réponds à la question juridique de manière détaillée et documentée.`

  const stream = await model.stream([
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ])

  for await (const chunk of stream) {
    const content = chunk.content?.toString() || ''
    if (content) {
      yield { type: 'token', data: content }
    }
  }

  yield {
    type: 'done',
    data: {
      sessionId,
      documentCount: topDocuments.length,
      toolCalls: formatToolCallsForDisplay(sessionId),
    },
  }
}

/**
 * Get tool definitions for the Web Lawyer
 */
export function getWebLawyerTools(): ReturnType<typeof getToolDefinitions> {
  return getToolDefinitions()
}
