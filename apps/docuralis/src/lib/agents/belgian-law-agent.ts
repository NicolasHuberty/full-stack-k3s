/**
 * Belgian Law ReAct Agent
 *
 * Autonomous agent for Belgian law research that combines:
 * - RAG: Search uploaded documents (MUST be queried from multiple angles)
 * - JuPortal: Search Belgian jurisprudence
 * - Moniteur Belge: Search Belgian legislation
 *
 * CRITICAL: This agent MUST:
 * 1. Query RAG from multiple angles before answering
 * 2. Query JuPortal with multiple different queries
 * 3. Query Moniteur Belge with multiple different queries
 * 4. Only generate final answer after comprehensive exploration
 */

import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'
import { StateGraph, END, START } from '@langchain/langgraph'
import { v4 as uuidv4 } from 'uuid'
import {
  executeJuportalSearch,
  fetchJurisprudenceContent,
} from '../tools/juportal'
import {
  executeMoniteurBelgeSearch,
  fetchLegislationContent,
  LegislationDocument,
  LegislationContent,
} from '../tools/moniteur-belge'
import { searchDocuments } from '../rag/service'
import type { ToolCallInfo } from './types'
import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'

// Suggested minimum searches - agent can decide based on context
// These are GUIDELINES, not hard requirements
const SUGGESTED_RAG_SEARCHES = 2 // Suggest at least 2 RAG searches
const SUGGESTED_JUPORTAL_SEARCHES = 2 // Suggest at least 2 jurisprudence searches
const SUGGESTED_MONITEUR_SEARCHES = 1 // Suggest at least 1 legislation search - ALWAYS use this tool

// Maximum documents to fetch with full content
const MAX_JURISPRUDENCE_FULL_TEXT = 5 // Fetch full content for top 5 decisions

// Agent State
export interface BelgianLawAgentState {
  // Input
  query: string
  userId: string
  collectionId?: string
  sessionId?: string

  // ReAct loop state
  thoughts: string[]
  actions: ToolAction[]
  observations: string[]
  iteration: number
  maxIterations: number

  // Search coverage tracking - CRITICAL for ensuring comprehensive exploration
  searchCoverage: {
    ragQueries: string[]
    juportalQueries: string[]
    moniteurQueries: string[]
    ragResultCount: number
    juportalResultCount: number
    moniteurResultCount: number
  }

  // Search tracking for retry logic
  failedSearches: FailedSearch[]
  successfulSearches: SuccessfulSearch[]

  // Tool calls tracking
  toolCalls: ToolCallInfo[]

  // Results from tools
  ragResults: RagChunk[]
  jurisprudenceResults: JurisprudenceResult[]
  legislationResults: LegislationDocument[]

  // Final output
  answer: string
  sources: SourceReference[]

  // Metadata
  error?: string
  inputTokens: number
  outputTokens: number
}

export interface ToolAction {
  tool: 'rag' | 'juportal' | 'moniteur_belge' | 'final_answer'
  args: Record<string, unknown>
  reasoning: string
}

export interface FailedSearch {
  tool: string
  query: string
  reason: string
  suggestedAlternatives: string[]
}

export interface SuccessfulSearch {
  tool: string
  query: string
  resultCount: number
}

export interface RagChunk {
  id: string
  content: string
  score: number
  documentId: string
  documentName: string
  pageNumber?: number
}

export interface JurisprudenceResult {
  ecli: string
  courtName: string
  decisionDate: string
  summary: string
  url: string
  fullText?: string // Full content of the decision (fetched separately)
}

export interface SourceReference {
  id: string // Unique ID for inline citation: rag:1, jur:1, leg:1
  type: 'rag' | 'jurisprudence' | 'legislation'
  title: string
  url?: string
  excerpt?: string
  // Additional fields for rich display
  ecli?: string
  courtName?: string
  decisionDate?: string
  documentName?: string
  pageNumber?: number
  numac?: string
  documentType?: string
  publicationDate?: string
}

// LLM instances - lazy initialization with API keys from database

/**
 * Get API key for a specific provider from the database
 */
async function getProviderApiKey(providerName: string): Promise<string | null> {
  try {
    const provider = await prisma.lLMProvider.findFirst({
      where: {
        name: {
          equals: providerName,
          mode: 'insensitive',
        },
      },
    })

    if (provider?.apiKey) {
      return decrypt(provider.apiKey)
    }

    // Fallback to environment variable
    const envKey = process.env[`${providerName.toUpperCase()}_API_KEY`]
    return envKey || null
  } catch (error) {
    console.error(
      `[BELGIAN-LAW-AGENT] Error getting ${providerName} API key:`,
      error
    )
    // Fallback to environment variable
    return process.env[`${providerName.toUpperCase()}_API_KEY`] || null
  }
}

// Cached models with API keys
let _mainModelCache: ChatAnthropic | null = null
let _pertinenceModelCache: ChatOpenAI | null = null
let _legacyModelCache: ChatOpenAI | null = null

/**
 * Main ReAct agent uses Claude Sonnet 4 for superior reasoning
 */
async function getMainModel(): Promise<ChatAnthropic> {
  if (!_mainModelCache) {
    const apiKey = await getProviderApiKey('anthropic')

    if (!apiKey) {
      throw new Error(
        'Anthropic API key not found. Please configure it in the Admin Panel or set ANTHROPIC_API_KEY environment variable.'
      )
    }

    _mainModelCache = new ChatAnthropic({
      modelName: 'claude-sonnet-4-20250514',
      temperature: 0,
      maxTokens: 8192,
      anthropicApiKey: apiKey,
    })
  }
  return _mainModelCache
}

/**
 * Pertinence analyzer uses a faster model for filtering
 */
async function getPertinenceModel(): Promise<ChatOpenAI> {
  if (!_pertinenceModelCache) {
    const apiKey = await getProviderApiKey('openai')

    _pertinenceModelCache = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0,
      openAIApiKey: apiKey || undefined,
    })
  }
  return _pertinenceModelCache
}

/**
 * Legacy model for backward compatibility
 */
async function getModel(): Promise<ChatOpenAI> {
  if (!_legacyModelCache) {
    const apiKey = await getProviderApiKey('openai')

    _legacyModelCache = new ChatOpenAI({
      modelName: 'gpt-4o',
      temperature: 0,
      openAIApiKey: apiKey || undefined,
    })
  }
  return _legacyModelCache
}

/**
 * Pertinence result for a document
 */
interface PertinenceResult {
  isPertinent: boolean
  pertinenceScore: number // 0-10
  justification: string
  keyRelevantPassages?: string[]
}

/**
 * Judge the pertinence of a document for the legal question
 * Uses LLM to evaluate if document is relevant and extract key passages
 */
async function judgePertinence(
  query: string,
  documentType: 'rag' | 'jurisprudence' | 'legislation',
  documentContent: string,
  documentMetadata: {
    title?: string
    source?: string
    ecli?: string
    date?: string
  }
): Promise<PertinenceResult> {
  const systemPrompt = `Tu es un assistant juridique expert. Ta tâche est d'évaluer la PERTINENCE d'un document par rapport à une question juridique.

RÈGLES D'ÉVALUATION:
1. Un document est PERTINENT s'il:
   - Traite directement de la question juridique posée
   - Contient des informations sur les concepts juridiques mentionnés
   - Cite ou applique les articles de loi mentionnés dans la question
   - Aborde la compétence, la procédure ou le fond liés à la question

2. Un document est NON PERTINENT s'il:
   - Traite d'un sujet complètement différent
   - Ne mentionne aucun des concepts juridiques de la question
   - Est trop général et n'apporte pas d'information utile

SCORE DE PERTINENCE (0-10):
- 0-2: Pas du tout pertinent
- 3-4: Peu pertinent (mentionne un concept mais pas dans le bon contexte)
- 5-6: Moyennement pertinent (aborde le sujet mais indirectement)
- 7-8: Pertinent (traite directement d'un aspect de la question)
- 9-10: Très pertinent (traite directement de la question avec des informations précises)

Réponds en JSON:
{
  "isPertinent": true/false,
  "pertinenceScore": 0-10,
  "justification": "Explication courte de pourquoi le document est pertinent ou non",
  "keyRelevantPassages": ["passage 1", "passage 2"] // Si pertinent, extrait les passages clés
}`

  const documentInfo = `Type: ${documentType}
Titre/Source: ${documentMetadata.title || documentMetadata.source || documentMetadata.ecli || 'N/A'}
Date: ${documentMetadata.date || 'N/A'}

Contenu:
${documentContent.slice(0, 3000)}${documentContent.length > 3000 ? '...[tronqué]' : ''}`

  const userPrompt = `Question juridique: "${query}"

Document à évaluer:
${documentInfo}

Évalue la pertinence de ce document pour répondre à la question juridique. Réponds en JSON.`

  try {
    const model = await getPertinenceModel()
    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const content = response.content.toString().trim()
    const jsonMatch = content.match(/\{[\s\S]*\}/)

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        isPertinent: parsed.isPertinent === true || parsed.pertinenceScore >= 5,
        pertinenceScore: parsed.pertinenceScore || 0,
        justification: parsed.justification || '',
        keyRelevantPassages: parsed.keyRelevantPassages || [],
      }
    }

    // Default to pertinent if parsing fails
    return {
      isPertinent: true,
      pertinenceScore: 5,
      justification: 'Évaluation par défaut - parsing échoué',
    }
  } catch (error) {
    console.error('[PERTINENCE] Error judging pertinence:', error)
    // Default to pertinent on error to avoid losing documents
    return {
      isPertinent: true,
      pertinenceScore: 5,
      justification: 'Évaluation par défaut - erreur',
    }
  }
}

/**
 * Filter documents by pertinence for RAG results - PARALLEL execution
 */
async function filterRagByPertinence(
  query: string,
  documents: RagChunk[]
): Promise<RagChunk[]> {
  console.log(
    `[PERTINENCE] Filtering ${documents.length} RAG documents in parallel...`
  )

  // Run all pertinence evaluations in parallel
  const results = await Promise.all(
    documents.map(async (doc) => {
      const result = await judgePertinence(query, 'rag', doc.content, {
        title: doc.documentName,
        source: doc.documentId,
      })
      return { doc, result }
    })
  )

  // Filter and log results
  const pertinentDocs: RagChunk[] = []
  for (const { doc, result } of results) {
    if (result.isPertinent && result.pertinenceScore >= 5) {
      pertinentDocs.push({
        ...doc,
        score: Math.max(doc.score, result.pertinenceScore / 10),
      })
      console.log(
        `[PERTINENCE] ✅ RAG pertinent (${result.pertinenceScore}/10): ${doc.documentName}`
      )
    } else {
      console.log(
        `[PERTINENCE] ❌ RAG non pertinent (${result.pertinenceScore}/10): ${doc.documentName}`
      )
    }
  }

  console.log(
    `[PERTINENCE] ${pertinentDocs.length}/${documents.length} RAG documents kept`
  )
  return pertinentDocs
}

/**
 * Filter jurisprudence by pertinence - PARALLEL execution
 */
async function filterJurisprudenceByPertinence(
  query: string,
  documents: JurisprudenceResult[]
): Promise<JurisprudenceResult[]> {
  console.log(
    `[PERTINENCE] Filtering ${documents.length} jurisprudence documents in parallel...`
  )

  // Run all pertinence evaluations in parallel
  const results = await Promise.all(
    documents.map(async (doc) => {
      const content = doc.fullText || doc.summary || ''
      if (!content) {
        // Keep documents without content
        return {
          doc,
          result: {
            isPertinent: true,
            pertinenceScore: 5,
            justification: 'No content to evaluate',
          },
        }
      }

      const result = await judgePertinence(query, 'jurisprudence', content, {
        ecli: doc.ecli,
        title: `${doc.ecli} - ${doc.courtName}`,
        date: doc.decisionDate,
      })
      return { doc, result }
    })
  )

  // Filter and log results
  const pertinentDocs: JurisprudenceResult[] = []
  for (const { doc, result } of results) {
    if (result.isPertinent && result.pertinenceScore >= 4) {
      pertinentDocs.push(doc)
      console.log(
        `[PERTINENCE] ✅ Jurisprudence pertinente (${result.pertinenceScore}/10): ${doc.ecli}`
      )
    } else {
      console.log(
        `[PERTINENCE] ❌ Jurisprudence non pertinente (${result.pertinenceScore}/10): ${doc.ecli}`
      )
    }
  }

  console.log(
    `[PERTINENCE] ${pertinentDocs.length}/${documents.length} jurisprudence documents kept`
  )
  return pertinentDocs
}

/**
 * Filter legislation by pertinence - PARALLEL execution
 */
async function filterLegislationByPertinence(
  query: string,
  documents: LegislationDocument[]
): Promise<LegislationDocument[]> {
  console.log(
    `[PERTINENCE] Filtering ${documents.length} legislation documents in parallel...`
  )

  // Run all pertinence evaluations in parallel
  const results = await Promise.all(
    documents.map(async (doc) => {
      const content = doc.summary || doc.title || ''

      const result = await judgePertinence(query, 'legislation', content, {
        title: doc.title,
        date: doc.publicationDate,
      })
      return { doc, result }
    })
  )

  // Filter and log results
  const pertinentDocs: LegislationDocument[] = []
  for (const { doc, result } of results) {
    if (result.isPertinent && result.pertinenceScore >= 4) {
      pertinentDocs.push(doc)
      console.log(
        `[PERTINENCE] ✅ Législation pertinente (${result.pertinenceScore}/10): ${doc.title.slice(0, 50)}...`
      )
    } else {
      console.log(
        `[PERTINENCE] ❌ Législation non pertinente (${result.pertinenceScore}/10): ${doc.title.slice(0, 50)}...`
      )
    }
  }

  console.log(
    `[PERTINENCE] ${pertinentDocs.length}/${documents.length} legislation documents kept`
  )
  return pertinentDocs
}

/**
 * Extract article references from query (e.g., "article 5:77", "art. 590")
 */
function extractArticleReferences(query: string): string[] {
  const articles: string[] = []

  // Pattern 1: "article X" or "art. X" with various formats
  // Matches: article 5:77, art. 590, article 5:77 § 2, articles 590 et 591
  const articlePatterns = [
    /articles?\s*(\d+[\:\-\.]?\d*(?:\s*§\s*\d+)?(?:\s*(?:et|,)\s*\d+[\:\-\.]?\d*(?:\s*§\s*\d+)?)*)/gi,
    /art\.\s*(\d+[\:\-\.]?\d*(?:\s*§\s*\d+)?)/gi,
  ]

  for (const pattern of articlePatterns) {
    let match
    while ((match = pattern.exec(query)) !== null) {
      const articleNum = match[1].trim()
      articles.push(`article ${articleNum}`)
    }
  }

  return Array.from(new Set(articles))
}

/**
 * Extract code/law names from query
 */
function extractCodeNames(query: string): string[] {
  const codes: string[] = []

  // Belgian codes and laws
  const codePatterns = [
    // Code des sociétés et des associations (CSA)
    /Code\s+(?:des\s+)?sociétés\s+(?:et\s+(?:des\s+)?associations)?/gi,
    /C\.?S\.?A\.?/gi,
    // Code judiciaire
    /Code\s+judiciaire/gi,
    /C\.?\s*jud\.?/gi,
    // Code civil
    /Code\s+civil/gi,
    // Code pénal
    /Code\s+pénal/gi,
    // Code de commerce (ancien)
    /Code\s+(?:de\s+)?commerce/gi,
    // Loi sur les baux commerciaux
    /loi\s+(?:sur\s+)?(?:les\s+)?baux?\s+commercia(?:ux|l)/gi,
    // Loi hypothécaire
    /loi\s+hypothécaire/gi,
    // Droit commun
    /droit\s+commun/gi,
  ]

  for (const pattern of codePatterns) {
    const match = query.match(pattern)
    if (match) {
      codes.push(match[0])
    }
  }

  return Array.from(new Set(codes))
}

/**
 * Extract legal concepts and keywords from query
 */
function extractLegalConcepts(query: string): string[] {
  const concepts: string[] = []

  // Core legal concepts - prioritized
  const priorityConcepts = [
    // Competence
    {
      pattern: /compétence\s+(?:matérielle|territoriale|exclusive)/gi,
      term: null,
    },
    { pattern: /juge\s+de\s+paix/gi, term: 'juge de paix' },
    {
      pattern:
        /tribunal\s+(?:de\s+)?(?:commerce|première instance|entreprise)/gi,
      term: null,
    },
    // Contract types
    { pattern: /bail\s+commercial/gi, term: 'bail commercial' },
    { pattern: /contrat\s+de\s+bail/gi, term: 'contrat bail' },
    { pattern: /bail\s+(?:à\s+)?loyer/gi, term: 'bail loyer' },
    // Nullity/validity
    { pattern: /nullité(?:\s+du\s+contrat)?/gi, term: 'nullité' },
    { pattern: /validité/gi, term: 'validité' },
    { pattern: /annulation/gi, term: 'annulation' },
    // Corporate law
    {
      pattern:
        /société\s+(?:anonyme|à\s+responsabilité\s+limitée|coopérative)/gi,
      term: null,
    },
    { pattern: /associé(?:s)?/gi, term: 'associé' },
    { pattern: /administrateur(?:s)?/gi, term: 'administrateur' },
    { pattern: /gérant(?:s)?/gi, term: 'gérant' },
  ]

  for (const { pattern, term } of priorityConcepts) {
    const match = query.match(pattern)
    if (match) {
      concepts.push(term || match[0])
    }
  }

  // Also extract individual legal keywords
  const keywords = query.match(
    /(?:nullité|bail|commercial|compétence|juge|paix|société|contrat|violation|procédure|judiciaire|matérielle|territoriale|tribunal|entreprise|loyer|location|résiliation|préavis)/gi
  )

  if (keywords) {
    concepts.push(...keywords.map((k) => k.toLowerCase()))
  }

  return Array.from(new Set(concepts))
}

/**
 * Decompose a legal query into multiple search angles
 * CRITICAL: This function must extract:
 * 1. Article references (e.g., "article 5:77")
 * 2. Code names (e.g., "Code des sociétés et associations")
 * 3. Legal concepts (e.g., "compétence juge de paix", "bail commercial")
 */
function decomposeQueryIntoAngles(query: string): string[] {
  const angles: string[] = []

  // 1. Extract article references - HIGHEST PRIORITY
  const articles = extractArticleReferences(query)
  articles.forEach((article) => {
    angles.push(article)
  })

  // 2. Extract code names - HIGH PRIORITY
  const codes = extractCodeNames(query)
  codes.forEach((code) => {
    angles.push(code)
    // Combine code with article if both exist
    if (articles.length > 0) {
      angles.push(`${articles[0]} ${code}`)
    }
  })

  // 3. Extract legal concepts
  const concepts = extractLegalConcepts(query)

  // Create smart combinations
  // Combination: juge de paix + bail commercial
  if (
    concepts.includes('juge de paix') &&
    (concepts.includes('bail commercial') ||
      query.toLowerCase().includes('bail'))
  ) {
    angles.push('compétence juge paix bail')
    angles.push('juge paix bail commercial')
  }

  // Combination: compétence + juge de paix
  if (
    concepts.some((c) => c.includes('compétence')) &&
    concepts.includes('juge de paix')
  ) {
    angles.push('compétence matérielle juge paix')
  }

  // Combination: nullité + contrat/bail
  if (
    concepts.includes('nullité') &&
    (concepts.includes('contrat') || concepts.includes('bail'))
  ) {
    angles.push('nullité contrat')
    angles.push('nullité bail')
  }

  // Combination: société + violation
  if (
    concepts.some((c) => c.includes('société')) &&
    query.toLowerCase().includes('violation')
  ) {
    angles.push('violation statuts société')
    angles.push('violation Code sociétés')
  }

  // Add relevant Code judiciaire articles for competence questions
  if (
    query.toLowerCase().includes('compétence') &&
    query.toLowerCase().includes('juge')
  ) {
    angles.push('article 590 Code judiciaire')
    angles.push('article 591 Code judiciaire')
    angles.push('compétence ratione materiae')
  }

  // 4. Add concept pairs for broader search
  const uniqueConcepts = Array.from(new Set(concepts))
  for (let i = 0; i < Math.min(uniqueConcepts.length - 1, 2); i++) {
    const pair = `${uniqueConcepts[i]} ${uniqueConcepts[i + 1]}`
    if (!angles.includes(pair)) {
      angles.push(pair)
    }
  }

  // 5. Add individual important concepts
  uniqueConcepts.slice(0, 3).forEach((concept) => {
    if (!angles.some((a) => a.includes(concept))) {
      angles.push(concept)
    }
  })

  // Remove duplicates and empty strings, prioritize specific queries
  const unique = Array.from(new Set(angles.filter((a) => a && a.length > 2)))

  // Sort by specificity (longer = more specific = higher priority)
  unique.sort((a, b) => b.length - a.length)

  console.log('[QUERY-DECOMPOSITION] Original query:', query)
  console.log('[QUERY-DECOMPOSITION] Extracted angles:', unique.slice(0, 8))

  return unique.slice(0, 8) // Return up to 8 angles
}

/**
 * Generate alternative search queries based on failed query
 */
function generateAlternativeQueries(
  originalQuery: string,
  tool: string
): string[] {
  const alternatives: string[] = []
  const lowerQuery = originalQuery.toLowerCase()

  // Extract article numbers from failed query to suggest related articles
  const articles = extractArticleReferences(originalQuery)
  const codes = extractCodeNames(originalQuery)

  // Tool-specific strategies
  if (tool === 'rag') {
    // For RAG, suggest broader terms from the original query
    if (lowerQuery.includes('compétence')) {
      alternatives.push('compétence matérielle')
      alternatives.push('compétence territoriale')
      alternatives.push('attribution compétence')
    }
    if (lowerQuery.includes('bail') || lowerQuery.includes('loyer')) {
      alternatives.push('bail commercial')
      alternatives.push('contrat bail')
      alternatives.push('loyer impayé')
    }
    if (lowerQuery.includes('société') || lowerQuery.includes('sociétés')) {
      alternatives.push('droit sociétés')
      alternatives.push('Code sociétés associations')
      alternatives.push('organes société')
    }
    if (lowerQuery.includes('juge') || lowerQuery.includes('paix')) {
      alternatives.push('juge de paix')
      alternatives.push('compétence juge paix')
    }
    if (lowerQuery.includes('nullité')) {
      alternatives.push('nullité contrat')
      alternatives.push('annulation acte')
      alternatives.push('nullité relative absolue')
    }
  }

  if (tool === 'juportal') {
    // For JuPortal, suggest 2-4 word legal phrases
    if (lowerQuery.includes('bail')) {
      alternatives.push('bail commercial')
      alternatives.push('expulsion bail')
      alternatives.push('résiliation bail')
      alternatives.push('loyer arriéré')
    }
    if (lowerQuery.includes('juge') || lowerQuery.includes('paix')) {
      alternatives.push('juge paix compétence')
      alternatives.push('justice paix')
      alternatives.push('compétence matérielle')
    }
    if (lowerQuery.includes('société') || lowerQuery.includes('sociétés')) {
      alternatives.push('société responsabilité')
      alternatives.push('administrateur société')
      alternatives.push('nullité acte société')
    }
    if (lowerQuery.includes('compétence')) {
      alternatives.push('compétence ratione materiae')
      alternatives.push('déclinatoire compétence')
      alternatives.push('exception incompétence')
    }
    // Article-specific searches
    if (articles.length > 0) {
      articles.forEach((art) => {
        alternatives.push(art)
      })
    }
  }

  if (tool === 'moniteur_belge') {
    // For Moniteur Belge, suggest specific law/code names
    // These are known to work well with the Justel search
    if (lowerQuery.includes('bail') || lowerQuery.includes('loyer')) {
      alternatives.push('bail commercial')
      alternatives.push('bail habitation')
      alternatives.push('loyer')
    }
    if (
      lowerQuery.includes('juge') ||
      lowerQuery.includes('paix') ||
      lowerQuery.includes('compétence')
    ) {
      alternatives.push('Code judiciaire')
      alternatives.push('organisation judiciaire')
      alternatives.push('compétence tribunaux')
    }
    if (lowerQuery.includes('société') || lowerQuery.includes('sociétés')) {
      alternatives.push('sociétés associations')
      alternatives.push('Code sociétés')
      alternatives.push('société anonyme')
    }
    // Specific article searches
    if (articles.length > 0) {
      articles.forEach((art) => {
        // Extract just the number for Moniteur Belge
        const numMatch = art.match(/\d+[\:\-\.]?\d*/)
        if (numMatch) {
          alternatives.push(`article ${numMatch[0]}`)
        }
      })
    }
    // Code-specific searches
    if (codes.length > 0) {
      codes.forEach((code) => {
        alternatives.push(code)
      })
    }
  }

  // Generic alternatives based on extracted legal terms
  const legalTerms = originalQuery.match(
    /(?:nullité|bail|commercial|compétence|juge|paix|société|contrat|violation|article|code|civil|judiciaire|travail|responsabilité|dommage|intérêt|créance|dette|propriété|location|loyer|résiliation|préavis)/gi
  )

  if (legalTerms && legalTerms.length >= 2) {
    const unique = Array.from(new Set(legalTerms.map((t) => t.toLowerCase())))
    // Create pairs of terms
    for (let i = 0; i < Math.min(unique.length, 3); i++) {
      for (let j = i + 1; j < Math.min(unique.length, 4); j++) {
        alternatives.push(`${unique[i]} ${unique[j]}`)
      }
    }
  }

  return Array.from(new Set(alternatives))
    .filter((a) => a.toLowerCase() !== originalQuery.toLowerCase())
    .slice(0, 6)
}

/**
 * Build search coverage summary for LLM
 */
function buildSearchCoverageSummary(state: BelgianLawAgentState): string {
  const coverage = state.searchCoverage
  let summary = '\n\n📊 COUVERTURE DE RECHERCHE:\n'

  summary += `\n📚 RAG (Documents uploadés): ${coverage.ragQueries.length}/${SUGGESTED_RAG_SEARCHES} recherches minimum`
  if (coverage.ragQueries.length > 0) {
    summary += ` - Requêtes: ${coverage.ragQueries.join(', ')}`
  }
  if (coverage.ragQueries.length < SUGGESTED_RAG_SEARCHES) {
    summary += ' ⚠️ INSUFFISANT'
  }

  summary += `\n⚖️ JuPortal (Jurisprudence): ${coverage.juportalQueries.length}/${SUGGESTED_JUPORTAL_SEARCHES} recherches minimum`
  if (coverage.juportalQueries.length > 0) {
    summary += ` - Requêtes: ${coverage.juportalQueries.join(', ')}`
  }
  if (coverage.juportalQueries.length < SUGGESTED_JUPORTAL_SEARCHES) {
    summary += ' ⚠️ INSUFFISANT'
  }

  summary += `\n📜 Moniteur Belge (Législation): ${coverage.moniteurQueries.length}/${SUGGESTED_MONITEUR_SEARCHES} recherches minimum`
  if (coverage.moniteurQueries.length > 0) {
    summary += ` - Requêtes: ${coverage.moniteurQueries.join(', ')}`
  }
  if (coverage.moniteurQueries.length === 0) {
    summary += ' 🔴🔴🔴 JAMAIS UTILISÉ - UTILISE-LE MAINTENANT!'
  } else if (coverage.moniteurQueries.length < SUGGESTED_MONITEUR_SEARCHES) {
    summary += ' ⚠️ INSUFFISANT'
  }

  // Check if coverage is sufficient
  const ragOk = coverage.ragQueries.length >= SUGGESTED_RAG_SEARCHES
  const juportalOk =
    coverage.juportalQueries.length >= SUGGESTED_JUPORTAL_SEARCHES
  const moniteurOk =
    coverage.moniteurQueries.length >= SUGGESTED_MONITEUR_SEARCHES

  if (!ragOk || !juportalOk || !moniteurOk) {
    summary +=
      '\n\n🚫 COUVERTURE INSUFFISANTE - Tu ne peux PAS encore générer la réponse finale!'
    summary += "\n   Tu DOIS d'abord effectuer les recherches manquantes."
  } else {
    summary +=
      '\n\n✅ Couverture suffisante - Tu peux maintenant générer la réponse finale.'
  }

  return summary
}

/**
 * Build search history summary for LLM
 */
function buildSearchHistory(state: BelgianLawAgentState): string {
  let history = ''

  if (state.failedSearches.length > 0) {
    history += '\n\n⚠️ RECHERCHES ÉCHOUÉES (0 résultats):\n'
    state.failedSearches.forEach((f) => {
      history += `- ${f.tool}: "${f.query}" → ${f.reason}\n`
      if (f.suggestedAlternatives.length > 0) {
        history += `  Alternatives suggérées: ${f.suggestedAlternatives.slice(0, 3).join(', ')}\n`
      }
    })
  }

  if (state.successfulSearches.length > 0) {
    history += '\n\n✅ RECHERCHES RÉUSSIES:\n'
    state.successfulSearches.forEach((s) => {
      history += `- ${s.tool}: "${s.query}" → ${s.resultCount} résultats\n`
    })
  }

  return history
}

/**
 * Check if search coverage is sufficient for final answer
 * Now more flexible - only requires Moniteur Belge to be used at least once
 * RAG and JuPortal usage is at the agent's discretion based on context
 */
function isSearchCoverageSufficient(state: BelgianLawAgentState): boolean {
  const coverage = state.searchCoverage

  // ONLY hard requirement: Moniteur Belge must be used at least once
  // The agent should always cite legislation for legal questions
  const moniteurUsed = coverage.moniteurQueries.length >= 1

  // Soft check: at least some research should be done
  const someResearchDone =
    coverage.ragQueries.length >= 1 || coverage.juportalQueries.length >= 1

  return moniteurUsed && someResearchDone
}

/**
 * Determine if Moniteur Belge should be forced
 * Only forces Moniteur Belge if it hasn't been used at all
 * Other tools are at the agent's discretion
 */
function shouldForceMoniteurBelge(state: BelgianLawAgentState): boolean {
  const coverage = state.searchCoverage

  // Force Moniteur Belge if not used yet and we've done at least 1 other search
  const totalOtherSearches =
    coverage.ragQueries.length + coverage.juportalQueries.length
  return coverage.moniteurQueries.length === 0 && totalOtherSearches >= 1
}

/**
 * Suggest next search based on coverage gaps
 */
function suggestNextSearch(state: BelgianLawAgentState): string {
  const coverage = state.searchCoverage

  // Only suggest Moniteur Belge if not used yet
  if (shouldForceMoniteurBelge(state)) {
    return `🔴 UTILISE MONITEUR BELGE MAINTENANT - Tu n'as pas encore cherché de législation!`
  }

  // Otherwise, let the agent decide based on the question
  if (coverage.moniteurQueries.length === 0) {
    return `💡 Suggestion: Pense à chercher dans le Moniteur Belge pour trouver les articles de loi applicables`
  }

  return "Tu peux continuer à explorer ou générer la réponse finale si tu as assez d'informations"
}

/**
 * ReAct Planning Node
 * Decides which tool to use next based on current state
 */
export async function planNextAction(
  state: BelgianLawAgentState
): Promise<Partial<BelgianLawAgentState>> {
  console.log(
    `[BELGIAN-LAW-AGENT] Planning iteration ${state.iteration + 1}/${state.maxIterations}`
  )

  // Build context from previous actions and observations
  let context = ''
  for (let i = 0; i < state.actions.length; i++) {
    context += `\n\nAction ${i + 1}: ${state.actions[i].tool}(${JSON.stringify(state.actions[i].args)})`
    context += `\nReasoning: ${state.actions[i].reasoning}`
    if (state.observations[i]) {
      context += `\nObservation: ${state.observations[i].slice(0, 500)}...`
    }
  }

  // Add search coverage and history
  const coverageSummary = buildSearchCoverageSummary(state)
  const searchHistory = buildSearchHistory(state)
  const nextSuggestion = suggestNextSearch(state)
  const queryAngles = decomposeQueryIntoAngles(state.query)

  // Extract specific legal references for the LLM
  const extractedArticles = extractArticleReferences(state.query)
  const extractedCodes = extractCodeNames(state.query)
  const extractedConcepts = extractLegalConcepts(state.query)

  const articlesSection =
    extractedArticles.length > 0
      ? `\n📝 ARTICLES MENTIONNÉS: ${extractedArticles.join(', ')}`
      : ''
  const codesSection =
    extractedCodes.length > 0
      ? `\n📚 CODES/LOIS MENTIONNÉS: ${extractedCodes.join(', ')}`
      : ''
  const conceptsSection =
    extractedConcepts.length > 0
      ? `\n⚖️ CONCEPTS JURIDIQUES: ${extractedConcepts.slice(0, 5).join(', ')}`
      : ''

  const systemPrompt = `═══════════════════════════════════════════════════════════════════════════════
🏛️ AGENT JURIDIQUE BELGE - ASSISTANT DE RECHERCHE JURIDIQUE AVANCÉ
═══════════════════════════════════════════════════════════════════════════════

Tu es un agent de recherche juridique de haut niveau spécialisé en droit belge.
Ta MISSION FONDAMENTALE est d'ASSISTER LES AVOCATS dans leurs recherches juridiques
en fournissant les analyses les plus COMPLÈTES, DÉTAILLÉES et DOCUMENTÉES possibles.

🎯 OBJECTIF PRINCIPAL:
Aider l'avocat à répondre à la question juridique avec le MAXIMUM DE DÉTAILS en:
- Citant un MAXIMUM de jurisprudence pertinente avec les textes complets
- Identifiant TOUS les articles de loi applicables
- Analysant les documents du client sous TOUS les angles pertinents
- Construisant une argumentation juridique SOLIDE et ÉTAYÉE

═══════════════════════════════════════════════════════════════════════════════
📚 OUTILS DISPONIBLES
═══════════════════════════════════════════════════════════════════════════════

1. **rag** - Recherche dans les documents du client
   - Recherche les documents uploadés par l'utilisateur (contrats, statuts, correspondances...)
   - Cherche les clauses pertinentes, les stipulations, les éléments de preuve
   - Args: { "query": "termes de recherche" }
   - Angles suggérés: ${queryAngles.slice(0, 5).join(', ')}

2. **juportal** - Recherche de jurisprudence belge (JUPORTAL)
   - Accès à toute la jurisprudence belge (Cassation, Conseil d'État, Cour constitutionnelle, Cours d'appel...)
   - Le système récupère automatiquement le TEXTE COMPLET des décisions
   - Requêtes COURTES et PRÉCISES (2-4 mots-clés) - Ex: "anatocisme", "bail commercial", "article 5.91"
   - Args: { "query": "anatocisme" }

3. **moniteur_belge** - Recherche de législation belge (Moniteur Belge / Justel) ⚠️ OBLIGATOIRE
   - Accès aux lois, arrêtés royaux, codes, TEXTES OFFICIELS des articles de loi
   - 🔴 TU DOIS UTILISER CET OUTIL AU MOINS UNE FOIS pour chaque question juridique
   - 🔴 C'est LA SOURCE pour trouver le texte exact des articles de loi (ex: article 5.91 Code civil)
   - Requêtes SIMPLES et DIRECTES - Ex: "anatocisme", "code civil 5.91", "intérêts capitalisation"
   - Args: { "query": "anatocisme", "documentType": "ALL" }
   - Cherche avec les termes juridiques exacts de la question

4. **final_answer** - Générer la réponse finale UNIQUEMENT quand la recherche est complète
   - ⚠️ BLOQUÉ tant que les minimums de recherche ne sont pas atteints!
   - Args: { "ready": true }

═══════════════════════════════════════════════════════════════════════════════
📋 ÉLÉMENTS EXTRAITS DE LA QUESTION JURIDIQUE
═══════════════════════════════════════════════════════════════════════════════
${articlesSection}${codesSection}${conceptsSection}

🎯 CES ÉLÉMENTS DOIVENT ÊTRE RECHERCHÉS EN PRIORITÉ dans les 3 sources!

═══════════════════════════════════════════════════════════════════════════════
⚖️ STRATÉGIE DE RECHERCHE
═══════════════════════════════════════════════════════════════════════════════

Tu décides combien de recherches faire en fonction de la question.
UNE SEULE RÈGLE OBLIGATOIRE: Utiliser le Moniteur Belge au moins 1 fois.

1. DOCUMENTS DU CLIENT (RAG) - si pertinent
   • Utile si la question concerne des documents spécifiques du client

2. JURISPRUDENCE (JUPORTAL) - recommandé
   • Cherche des décisions sur le sujet de la question

3. LÉGISLATION (MONITEUR BELGE) ⚠️ OBLIGATOIRE
   • 🔴 TOUJOURS chercher les textes de loi applicables
   • Utilise les termes juridiques EXACTS de la question
   • Ex: pour "anatocisme", cherche "anatocisme" ou "capitalisation intérêts"

4. GÉNÉRATION DE LA RÉPONSE
   • Tu peux générer dès que tu as trouvé la législation pertinente
   • Cite les sources avec les références exactes

═══════════════════════════════════════════════════════════════════════════════
🚨 RÈGLE UNIQUE
═══════════════════════════════════════════════════════════════════════════════

🔴 TU DOIS UTILISER LE MONITEUR BELGE AU MOINS UNE FOIS 🔴

Pour chaque question juridique, tu dois chercher la législation applicable.
Le système bloquera ta réponse si tu n'as pas utilisé le Moniteur Belge.

Pour les autres outils (RAG, JuPortal), tu décides selon la question.

${nextSuggestion}

═══════════════════════════════════════════════════════════════════════════════
📤 FORMAT DE RÉPONSE (JSON strict)
═══════════════════════════════════════════════════════════════════════════════
{
  "thought": "Ma réflexion détaillée sur l'état actuel de la recherche, ce que j'ai trouvé, ce qui manque, et pourquoi je choisis cette prochaine action...",
  "action": {
    "tool": "rag|juportal|moniteur_belge|final_answer",
    "args": { ... },
    "reasoning": "Justification précise de cette recherche et des termes choisis..."
  }
}`

  const userPrompt = `Question de l'utilisateur: "${state.query}"

ANGLES DE RECHERCHE SUGGÉRÉS: ${queryAngles.join(', ')}

${context ? `Historique des actions:${context}` : 'Aucune action précédente.'}
${coverageSummary}
${searchHistory}

ÉTAT ACTUEL:
- Documents RAG: ${state.ragResults.length} chunks trouvés
- Jurisprudence: ${state.jurisprudenceResults.length} décisions trouvées
- Législation: ${state.legislationResults.length} textes trouvés
- Itération: ${state.iteration + 1}/${state.maxIterations}

Décide de la prochaine action. Réponds en JSON.`

  try {
    // Use Claude Sonnet 4 for superior reasoning in the main ReAct loop
    const mainModel = await getMainModel()
    const response = await mainModel.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const content = response.content.toString().trim()

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.log(
        '[BELGIAN-LAW-AGENT] No JSON found, defaulting to final_answer'
      )
      return {
        actions: [
          ...state.actions,
          {
            tool: 'final_answer',
            args: { ready: true },
            reasoning: 'Could not parse response, generating answer',
          },
        ],
        thoughts: [...state.thoughts, 'Generating final answer'],
        inputTokens:
          state.inputTokens + (response.usage_metadata?.input_tokens || 0),
        outputTokens:
          state.outputTokens + (response.usage_metadata?.output_tokens || 0),
      }
    }

    const parsed = JSON.parse(jsonMatch[0])
    const thought = parsed.thought || ''
    let action: ToolAction = parsed.action || {
      tool: 'final_answer',
      args: { ready: true },
      reasoning: 'Default action',
    }

    // ENFORCE: Block final_answer if Moniteur Belge hasn't been used
    if (
      action.tool === 'final_answer' &&
      !isSearchCoverageSufficient(state) &&
      state.iteration < state.maxIterations - 1
    ) {
      console.log(
        '[BELGIAN-LAW-AGENT] ⚠️ Blocking premature final_answer - Moniteur Belge not used'
      )
      // Force Moniteur Belge search - extract key terms from the query
      const keyTerms = state.query
        .toLowerCase()
        .match(
          /\b(code|article|loi|décret|civil|judiciaire|sociétés|bail|compétence|anatocisme|intérêts)\b/gi
        )
      const searchQuery =
        keyTerms?.slice(0, 2).join(' ') ||
        state.query.split(' ').slice(0, 3).join(' ')

      action = {
        tool: 'moniteur_belge',
        args: { query: searchQuery, documentType: 'ALL' },
        reasoning: `Moniteur Belge non utilisé - recherche de législation obligatoire. Recherche: "${searchQuery}"`,
      }
    }

    // ADDITIONAL ENFORCEMENT: Force Moniteur Belge after a few iterations if not used
    if (
      action.tool !== 'final_answer' &&
      action.tool !== 'moniteur_belge' &&
      shouldForceMoniteurBelge(state)
    ) {
      console.log(
        '[BELGIAN-LAW-AGENT] ⚠️ Forcing Moniteur Belge search (not yet used)'
      )
      // Extract relevant terms from the original query for Moniteur Belge
      const keyTerms = state.query
        .toLowerCase()
        .match(
          /\b(code|article|loi|décret|civil|judiciaire|sociétés|bail|compétence|anatocisme|intérêts|nouveau)\b/gi
        )
      const searchQuery =
        keyTerms?.slice(0, 2).join(' ') ||
        state.query.split(' ').slice(0, 3).join(' ')

      action = {
        tool: 'moniteur_belge',
        args: { query: searchQuery, documentType: 'ALL' },
        reasoning: `Législation non encore recherchée - utilisation obligatoire du Moniteur Belge. Recherche: "${searchQuery}"`,
      }
    }

    console.log(`[BELGIAN-LAW-AGENT] Thought: ${thought}`)
    console.log(`[BELGIAN-LAW-AGENT] Action: ${action.tool}`)
    if (action.args?.query) {
      console.log(`[BELGIAN-LAW-AGENT] Query: "${action.args.query}"`)
    }

    return {
      thoughts: [...state.thoughts, thought],
      actions: [...state.actions, action],
      inputTokens:
        state.inputTokens + (response.usage_metadata?.input_tokens || 0),
      outputTokens:
        state.outputTokens + (response.usage_metadata?.output_tokens || 0),
    }
  } catch (error) {
    console.error('[BELGIAN-LAW-AGENT] Planning error:', error)
    return {
      actions: [
        ...state.actions,
        {
          tool: 'final_answer',
          args: { ready: true },
          reasoning: 'Error in planning, generating answer',
        },
      ],
      thoughts: [...state.thoughts, `Planning error: ${error}`],
    }
  }
}

/**
 * Execute Tool Node
 * Executes the planned tool action
 */
export async function executeTool(
  state: BelgianLawAgentState
): Promise<Partial<BelgianLawAgentState>> {
  const lastAction = state.actions[state.actions.length - 1]
  if (!lastAction || lastAction.tool === 'final_answer') {
    return { iteration: state.iteration + 1 }
  }

  console.log(`[BELGIAN-LAW-AGENT] Executing tool: ${lastAction.tool}`)

  const toolCall: ToolCallInfo = {
    id: uuidv4(),
    name: lastAction.tool,
    status: 'running',
    startedAt: new Date().toISOString(),
    args: lastAction.args,
  }

  const toolCalls = [...state.toolCalls, toolCall]
  let observation = ''
  const startTime = Date.now()

  // Clone search coverage for updates
  const searchCoverage = { ...state.searchCoverage }

  try {
    switch (lastAction.tool) {
      case 'rag': {
        const query = (lastAction.args.query as string) || state.query
        console.log(`[BELGIAN-LAW-AGENT] RAG query: "${query}"`)

        // Track this query
        if (!searchCoverage.ragQueries.includes(query)) {
          searchCoverage.ragQueries = [...searchCoverage.ragQueries, query]
        }

        // Check if we have a collection ID
        if (!state.collectionId) {
          observation = `❌ RAG: Pas de collection spécifiée. Les documents de l'utilisateur ne peuvent pas être recherchés.`
          return {
            observations: [...state.observations, observation],
            searchCoverage,
            toolCalls: toolCalls.map((tc) =>
              tc.id === toolCall.id
                ? {
                    ...tc,
                    status: 'completed' as const,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startTime,
                    resultSummary: 'Pas de collection',
                  }
                : tc
            ),
            iteration: state.iteration + 1,
          }
        }

        try {
          // Actually search the RAG documents
          const results = await searchDocuments(state.collectionId, query, 10)

          if (results.length > 0) {
            const rawDocs: RagChunk[] = results.map((r, i) => ({
              id: `rag-${i}`,
              content: r.pageContent,
              score: r.metadata.similarity,
              documentId:
                ((r.metadata as Record<string, unknown>)
                  .documentId as string) || '',
              documentName: r.metadata.title,
              pageNumber: r.metadata.pageNumber,
            }))

            // Filter by pertinence - only keep truly relevant documents
            console.log(
              `[BELGIAN-LAW-AGENT] Filtering ${rawDocs.length} RAG results by pertinence...`
            )
            const docs = await filterRagByPertinence(state.query, rawDocs)

            searchCoverage.ragResultCount += docs.length

            observation = `✅ RAG: Trouvé ${rawDocs.length} passages, ${docs.length} pertinents pour "${query}":\n${docs
              .slice(0, 3)
              .map(
                (d) =>
                  `- ${d.documentName} (p.${d.pageNumber || 'N/A'}): ${d.content.slice(0, 100)}...`
              )
              .join('\n')}`

            const successfulSearches = [
              ...state.successfulSearches,
              { tool: 'rag', query, resultCount: docs.length },
            ]

            return {
              ragResults: [...state.ragResults, ...docs],
              observations: [...state.observations, observation],
              searchCoverage,
              successfulSearches,
              toolCalls: toolCalls.map((tc) =>
                tc.id === toolCall.id
                  ? {
                      ...tc,
                      status: 'completed' as const,
                      completedAt: new Date().toISOString(),
                      durationMs: Date.now() - startTime,
                      resultSummary: `${docs.length} passages trouvés`,
                    }
                  : tc
              ),
              iteration: state.iteration + 1,
            }
          } else {
            observation = `❌ RAG: 0 résultats pour "${query}" dans les documents uploadés.`

            const failedSearches = [
              ...state.failedSearches,
              {
                tool: 'rag',
                query,
                reason: '0 résultats',
                suggestedAlternatives: generateAlternativeQueries(query, 'rag'),
              },
            ]

            return {
              observations: [...state.observations, observation],
              searchCoverage,
              failedSearches,
              toolCalls: toolCalls.map((tc) =>
                tc.id === toolCall.id
                  ? {
                      ...tc,
                      status: 'completed' as const,
                      completedAt: new Date().toISOString(),
                      durationMs: Date.now() - startTime,
                      resultSummary: '0 résultats',
                    }
                  : tc
              ),
              iteration: state.iteration + 1,
            }
          }
        } catch (ragError) {
          console.error('[BELGIAN-LAW-AGENT] RAG error:', ragError)
          observation = `❌ RAG: Erreur lors de la recherche - ${ragError instanceof Error ? ragError.message : 'Erreur inconnue'}`

          return {
            observations: [...state.observations, observation],
            searchCoverage,
            toolCalls: toolCalls.map((tc) =>
              tc.id === toolCall.id
                ? {
                    ...tc,
                    status: 'error' as const,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startTime,
                    error:
                      ragError instanceof Error
                        ? ragError.message
                        : 'Unknown error',
                  }
                : tc
            ),
            iteration: state.iteration + 1,
          }
        }
      }

      case 'juportal': {
        const query = (lastAction.args.query as string) || state.query
        console.log(`[BELGIAN-LAW-AGENT] JuPortal query: "${query}"`)

        // Track this query
        if (!searchCoverage.juportalQueries.includes(query)) {
          searchCoverage.juportalQueries = [
            ...searchCoverage.juportalQueries,
            query,
          ]
        }

        const result = await executeJuportalSearch({
          query,
          limit: 15,
          languages: ['FR', 'NL', 'DE'],
        })

        if (result.success && result.data?.documents.length) {
          const rawDocs: JurisprudenceResult[] = result.data.documents.map(
            (d) => ({
              ecli: d.ecli,
              courtName: d.courtName,
              decisionDate: d.decisionDate,
              summary: d.summary || '',
              url: d.url,
            })
          )

          // STEP 1: Filter by pertinence FIRST using summaries (parallel)
          console.log(
            `[BELGIAN-LAW-AGENT] Filtering ${rawDocs.length} jurisprudence by pertinence...`
          )
          const pertinentDocs = await filterJurisprudenceByPertinence(
            state.query,
            rawDocs
          )

          // STEP 2: Fetch full content for ALL pertinent documents (parallel)
          console.log(
            `[BELGIAN-LAW-AGENT] Fetching full content for ${pertinentDocs.length} pertinent decisions in parallel...`
          )
          const enrichedDocs = await Promise.all(
            pertinentDocs.map(async (doc) => {
              try {
                console.log(
                  `[BELGIAN-LAW-AGENT] Fetching content for ${doc.ecli}...`
                )
                const contentResult = await fetchJurisprudenceContent(
                  doc.ecli,
                  doc.url
                )

                if (contentResult.success && contentResult.data?.fullText) {
                  console.log(
                    `[BELGIAN-LAW-AGENT] ✅ Got ${contentResult.data.fullText.length} chars for ${doc.ecli}`
                  )
                  return {
                    ...doc,
                    fullText: contentResult.data.fullText,
                    summary: contentResult.data.summary || doc.summary,
                  }
                } else {
                  console.log(
                    `[BELGIAN-LAW-AGENT] ⚠️ No content for ${doc.ecli}`
                  )
                  return doc
                }
              } catch (fetchError) {
                console.error(
                  `[BELGIAN-LAW-AGENT] Error fetching ${doc.ecli}:`,
                  fetchError
                )
                return doc
              }
            })
          )

          searchCoverage.juportalResultCount += enrichedDocs.length

          const enrichedCount = enrichedDocs.filter((d) => d.fullText).length
          observation = `✅ JuPortal: Trouvé ${rawDocs.length} décisions, ${enrichedDocs.length} pertinentes pour "${query}" (${enrichedCount} avec contenu complet):\n${enrichedDocs
            .slice(0, 5)
            .map(
              (d) =>
                `- [${d.ecli}](${d.url}) (${d.courtName}, ${d.decisionDate})${d.fullText ? ' [texte complet]' : ''}`
            )
            .join('\n')}`

          const successfulSearches = [
            ...state.successfulSearches,
            { tool: 'juportal', query, resultCount: enrichedDocs.length },
          ]

          return {
            jurisprudenceResults: [
              ...state.jurisprudenceResults,
              ...enrichedDocs,
            ],
            observations: [...state.observations, observation],
            searchCoverage,
            successfulSearches,
            toolCalls: toolCalls.map((tc) =>
              tc.id === toolCall.id
                ? {
                    ...tc,
                    status: 'completed' as const,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startTime,
                    resultSummary: `${enrichedDocs.length} décisions pertinentes (${enrichedCount} avec texte complet)`,
                  }
                : tc
            ),
            iteration: state.iteration + 1,
          }
        } else {
          const alternatives = generateAlternativeQueries(query, 'juportal')
          observation = `❌ JuPortal: 0 résultats pour "${query}". Essaie: ${alternatives.slice(0, 3).join(', ')}`

          const failedSearches = [
            ...state.failedSearches,
            {
              tool: 'juportal',
              query,
              reason: '0 résultats',
              suggestedAlternatives: alternatives,
            },
          ]

          return {
            observations: [...state.observations, observation],
            searchCoverage,
            failedSearches,
            toolCalls: toolCalls.map((tc) =>
              tc.id === toolCall.id
                ? {
                    ...tc,
                    status: 'completed' as const,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startTime,
                    resultSummary: `0 résultats - alternatives: ${alternatives.slice(0, 2).join(', ')}`,
                  }
                : tc
            ),
            iteration: state.iteration + 1,
          }
        }
      }

      case 'moniteur_belge': {
        const query = (lastAction.args.query as string) || state.query
        const docType = (lastAction.args.documentType as string) || 'ALL'

        console.log(
          `[BELGIAN-LAW-AGENT] Moniteur Belge query: "${query}" (type: ${docType})`
        )

        // Track this query
        if (!searchCoverage.moniteurQueries.includes(query)) {
          searchCoverage.moniteurQueries = [
            ...searchCoverage.moniteurQueries,
            query,
          ]
        }

        const result = await executeMoniteurBelgeSearch({
          query,
          documentType: docType,
          limit: 15,
        })

        if (result.success && result.data?.documents.length) {
          // For legislation, we DO NOT filter by pertinence because:
          // 1. The Moniteur Belge search is already keyword-based and targeted
          // 2. Legislation documents often have generic titles that don't mention specific terms
          // 3. If the search returns "Code Civil Livre 5" for "anatocisme", it's the correct result
          const docs = result.data.documents
          console.log(
            `[BELGIAN-LAW-AGENT] Moniteur Belge: ${docs.length} textes trouvés (pas de filtrage pertinence)`
          )

          searchCoverage.moniteurResultCount += docs.length

          // For the first document, fetch the full content and find matching articles
          let matchingArticlesInfo = ''
          let legislationFullContent: LegislationContent | null = null
          if (docs.length > 0) {
            console.log(
              `[BELGIAN-LAW-AGENT] Fetching full content for ${docs[0].numac} to find specific articles...`
            )
            legislationFullContent = await fetchLegislationContent(
              docs[0].numac,
              query
            )

            // Show table of contents if available (helps understand legislation structure)
            if (legislationFullContent.tableOfContents.length > 0) {
              const relevantTocEntries = legislationFullContent.tableOfContents
                .filter((entry) => {
                  const queryTerms = query.toLowerCase().split(/\s+/)
                  return queryTerms.some(
                    (term) =>
                      term.length > 3 && entry.toLowerCase().includes(term)
                  )
                })
                .slice(0, 10)

              if (relevantTocEntries.length > 0) {
                matchingArticlesInfo = `\n\n📑 TABLE DES MATIÈRES (sections pertinentes):\n${relevantTocEntries.map((e) => `  • ${e}`).join('\n')}`
              }
            }

            // Show matching articles if found
            if (legislationFullContent.matchingArticles.length > 0) {
              matchingArticlesInfo += `\n\n📜 ARTICLES TROUVÉS pour "${query}":\n${legislationFullContent.matchingArticles.map((a) => `  • ${a}`).join('\n')}`
              console.log(
                `[BELGIAN-LAW-AGENT] Found ${legislationFullContent.matchingArticles.length} matching articles`
              )
            } else {
              console.log(
                `[BELGIAN-LAW-AGENT] No specific articles found containing "${query}"`
              )
              // Add note that we have the full text available for analysis
              if (legislationFullContent.fullText.length > 0) {
                matchingArticlesInfo += `\n\n📝 Note: Le texte complet de la législation (${legislationFullContent.fullText.length} caractères) est disponible pour analyse.`
              }
            }

            if (legislationFullContent.eliUrl) {
              matchingArticlesInfo += `\n\n📖 Texte législatif complet: ${legislationFullContent.eliUrl}`
            }
          }

          observation = `✅ Moniteur Belge: Trouvé ${docs.length} textes législatifs pour "${query}":\n${docs
            .slice(0, 5)
            .map(
              (d) =>
                `- [${d.title.slice(0, 80)}...](${d.url}) (${d.documentType}, ${d.publicationDate})`
            )
            .join('\n')}${matchingArticlesInfo}`

          const successfulSearches = [
            ...state.successfulSearches,
            { tool: 'moniteur_belge', query, resultCount: docs.length },
          ]

          // Enrich the first document with the matching articles and full content
          const enrichedDocs = docs.map((doc, index) => {
            if (index === 0 && legislationFullContent) {
              return {
                ...doc,
                matchingArticles: legislationFullContent.matchingArticles,
                eliUrl: legislationFullContent.eliUrl,
                fullTextExcerpt: legislationFullContent.fullText.slice(0, 5000),
              }
            }
            return doc
          })

          return {
            legislationResults: [...state.legislationResults, ...enrichedDocs],
            observations: [...state.observations, observation],
            searchCoverage,
            successfulSearches,
            toolCalls: toolCalls.map((tc) =>
              tc.id === toolCall.id
                ? {
                    ...tc,
                    status: 'completed' as const,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startTime,
                    resultSummary: `${docs.length} textes pertinents trouvés${legislationFullContent?.matchingArticles.length ? ` (${legislationFullContent.matchingArticles.length} articles trouvés)` : ''}`,
                  }
                : tc
            ),
            iteration: state.iteration + 1,
          }
        } else {
          const alternatives = generateAlternativeQueries(
            query,
            'moniteur_belge'
          )
          observation = `❌ Moniteur Belge: 0 résultats pour "${query}". Essaie: ${alternatives.slice(0, 3).join(', ')}`

          const failedSearches = [
            ...state.failedSearches,
            {
              tool: 'moniteur_belge',
              query,
              reason: '0 résultats',
              suggestedAlternatives: alternatives,
            },
          ]

          return {
            observations: [...state.observations, observation],
            searchCoverage,
            failedSearches,
            toolCalls: toolCalls.map((tc) =>
              tc.id === toolCall.id
                ? {
                    ...tc,
                    status: 'completed' as const,
                    completedAt: new Date().toISOString(),
                    durationMs: Date.now() - startTime,
                    resultSummary: `0 résultats - alternatives: ${alternatives.slice(0, 2).join(', ')}`,
                  }
                : tc
            ),
            iteration: state.iteration + 1,
          }
        }
      }

      default:
        observation = `Unknown tool: ${lastAction.tool}`
    }

    toolCall.status = 'completed'
    toolCall.completedAt = new Date().toISOString()
    toolCall.durationMs = Date.now() - startTime
    toolCall.resultSummary = observation

    return {
      observations: [...state.observations, observation],
      searchCoverage,
      toolCalls: toolCalls.map((tc) => (tc.id === toolCall.id ? toolCall : tc)),
      iteration: state.iteration + 1,
    }
  } catch (error) {
    toolCall.status = 'error'
    toolCall.error = error instanceof Error ? error.message : 'Unknown error'
    toolCall.completedAt = new Date().toISOString()

    observation = `Error executing ${lastAction.tool}: ${toolCall.error}`

    return {
      observations: [...state.observations, observation],
      searchCoverage,
      toolCalls: toolCalls.map((tc) => (tc.id === toolCall.id ? toolCall : tc)),
      iteration: state.iteration + 1,
    }
  }
}

/**
 * Generate Final Response Node
 */
export async function generateFinalResponse(
  state: BelgianLawAgentState
): Promise<Partial<BelgianLawAgentState>> {
  console.log('[BELGIAN-LAW-AGENT] Generating final response')
  console.log(
    `[BELGIAN-LAW-AGENT] Stats: ${state.ragResults.length} RAG, ${state.jurisprudenceResults.length} jurisprudence, ${state.legislationResults.length} legislation`
  )

  // Build sources list with IDs FIRST - this is used for inline citations
  const sources: SourceReference[] = []

  // Build RAG sources
  const uniqueRagDocs = Array.from(
    new Map(state.ragResults.map((r) => [r.documentName, r])).values()
  ).slice(0, 10)

  uniqueRagDocs.forEach((r, i) => {
    sources.push({
      id: `rag:${i + 1}`,
      type: 'rag',
      title: r.documentName,
      documentName: r.documentName,
      pageNumber: r.pageNumber,
      excerpt: r.content?.slice(0, 300),
    })
  })

  // Build jurisprudence sources
  state.jurisprudenceResults.slice(0, 10).forEach((j, i) => {
    sources.push({
      id: `jur:${i + 1}`,
      type: 'jurisprudence',
      title: `${j.ecli} - ${j.courtName}`,
      ecli: j.ecli,
      courtName: j.courtName,
      decisionDate: j.decisionDate,
      url: j.url,
      excerpt: j.summary?.slice(0, 300) || j.fullText?.slice(0, 300),
    })
  })

  // Build legislation sources
  state.legislationResults.slice(0, 10).forEach((l, i) => {
    const docWithArticles = l as LegislationDocument & {
      matchingArticles?: string[]
      eliUrl?: string
    }
    sources.push({
      id: `leg:${i + 1}`,
      type: 'legislation',
      title: l.title,
      numac: l.numac,
      documentType: l.documentType,
      publicationDate: l.publicationDate,
      url: docWithArticles.eliUrl || l.url,
      excerpt:
        docWithArticles.matchingArticles?.join('\n')?.slice(0, 500) ||
        l.summary?.slice(0, 300),
    })
  })

  // Build context from all results with source IDs
  let ragContext = ''
  if (uniqueRagDocs.length > 0) {
    ragContext = `\n\n## Documents de la collection (RAG):\n`
    uniqueRagDocs.forEach((r, i) => {
      const sourceId = `rag:${i + 1}`
      ragContext += `\n**[#${sourceId}]** ${r.documentName} (page ${r.pageNumber || 'N/A'})\n`
      ragContext += `   ${r.content.slice(0, 400)}...\n`
    })
  }

  let jurisprudenceContext = ''
  if (state.jurisprudenceResults.length > 0) {
    const withFullText = state.jurisprudenceResults.filter((j) => j.fullText)
    const withSummaryOnly = state.jurisprudenceResults.filter(
      (j) => !j.fullText
    )

    if (withFullText.length > 0) {
      jurisprudenceContext = `\n\n## Jurisprudence - Textes complets:\n`
      withFullText.slice(0, 5).forEach((j) => {
        const sourceIndex = state.jurisprudenceResults.findIndex(
          (jr) => jr.ecli === j.ecli
        )
        const sourceId = `jur:${sourceIndex + 1}`
        jurisprudenceContext += `\n### **[#${sourceId}]** ${j.ecli} - ${j.courtName} (${j.decisionDate})\n`
        jurisprudenceContext += `**Texte de la décision:**\n${j.fullText?.slice(0, 3000) || j.summary}${(j.fullText?.length || 0) > 3000 ? '...[texte tronqué]' : ''}\n`
      })
    }

    if (withSummaryOnly.length > 0) {
      jurisprudenceContext += `\n\n## Autres décisions trouvées (résumés uniquement):\n`
      withSummaryOnly.slice(0, 10).forEach((j) => {
        const sourceIndex = state.jurisprudenceResults.findIndex(
          (jr) => jr.ecli === j.ecli
        )
        const sourceId = `jur:${sourceIndex + 1}`
        jurisprudenceContext += `\n**[#${sourceId}]** ${j.ecli} - ${j.courtName} (${j.decisionDate})\n`
        if (j.summary) {
          jurisprudenceContext += `   Résumé: ${j.summary.slice(0, 300)}...\n`
        }
      })
    }
  }

  let legislationContext = ''
  if (state.legislationResults.length > 0) {
    legislationContext = `\n\n## Législation trouvée:\n`
    state.legislationResults.slice(0, 10).forEach((l, i) => {
      const sourceId = `leg:${i + 1}`
      legislationContext += `\n**[#${sourceId}]** ${l.title} (${l.documentType})\n`
      legislationContext += `   Publication: ${l.publicationDate}\n`

      const docWithArticles = l as LegislationDocument & {
        matchingArticles?: string[]
        eliUrl?: string
      }

      if (
        docWithArticles.matchingArticles &&
        docWithArticles.matchingArticles.length > 0
      ) {
        legislationContext += `\n   🔴 **ARTICLES PERTINENTS TROUVÉS:**\n`
        docWithArticles.matchingArticles.forEach((article) => {
          legislationContext += `   📜 ${article}\n`
        })
      }

      if (l.summary) {
        legislationContext += `   Extrait: ${l.summary.slice(0, 200)}...\n`
      }
    })
  }

  // Build search summary
  let searchSummary = '\nRecherches effectuées:\n'
  searchSummary += `- RAG: ${state.searchCoverage.ragQueries.length} requêtes (${state.searchCoverage.ragResultCount} résultats)\n`
  searchSummary += `- JuPortal: ${state.searchCoverage.juportalQueries.length} requêtes (${state.searchCoverage.juportalResultCount} résultats)\n`
  searchSummary += `- Moniteur Belge: ${state.searchCoverage.moniteurQueries.length} requêtes (${state.searchCoverage.moniteurResultCount} résultats)\n`

  // Build sources reference for the LLM
  let sourcesReference =
    '\n\n## 📚 SOURCES DISPONIBLES (utilise les IDs pour citer):\n'
  sources.forEach((s) => {
    if (s.type === 'rag') {
      sourcesReference += `- **[#${s.id}]** 📄 ${s.documentName} (page ${s.pageNumber || 'N/A'})\n`
    } else if (s.type === 'jurisprudence') {
      sourcesReference += `- **[#${s.id}]** ⚖️ ${s.ecli} - ${s.courtName} (${s.decisionDate})\n`
    } else if (s.type === 'legislation') {
      sourcesReference += `- **[#${s.id}]** 📜 ${s.title.slice(0, 60)}... (${s.documentType})\n`
    }
  })

  const systemPrompt = `Tu es un avocat expert en droit belge avec 20 ans d'expérience. Tu fournis des analyses juridiques COMPLÈTES, DÉTAILLÉES et RIGOUREUSES.

🔴 RÈGLE CRITIQUE - CITATION DES SOURCES:
Tu DOIS citer tes sources EN LIGNE dans le texte en utilisant le format [#source_id].
Exemples: [#leg:1], [#jur:2], [#rag:1]

COMMENT CITER:
- Quand tu mentionnes un article de loi, ajoute [#leg:X] juste après
- Quand tu mentionnes une décision de justice, ajoute [#jur:X] juste après
- Quand tu mentionnes un document du client, ajoute [#rag:X] juste après

EXEMPLE:
"L'anatocisme est régi par l'article 5.207 du Code civil [#leg:1], qui dispose que..."
"Selon la Cour de cassation [#jur:1], ce principe s'applique..."

RÈGLES:
- Réponds TOUJOURS en français
- Cite tes sources EN LIGNE avec [#source_id] - PAS de liste de sources à la fin
- Utilise un formatage markdown professionnel
- Si des ARTICLES PERTINENTS sont trouvés (marqués avec 🔴), cite-les EXACTEMENT avec leur ID
- NE PAS inventer de numéros d'articles - utilise UNIQUEMENT ceux listés dans les sources

FORMAT DE RÉPONSE:

## Réponse à la question juridique
[Ta réponse structurée avec citations inline [#leg:1], [#jur:2], etc.]

## Cadre juridique applicable
[Textes de loi avec citations [#leg:X]]

## Analyse de la jurisprudence
[Décisions pertinentes avec citations [#jur:X]]

## Conclusion
[Synthèse avec références aux sources citées]

IMPORTANT: Ne mets PAS de section "Sources" à la fin - les sources sont citées inline!`

  const noResultsWarning =
    state.ragResults.length === 0 &&
    state.jurisprudenceResults.length === 0 &&
    state.legislationResults.length === 0
      ? "\n\n⚠️ ATTENTION: Aucune source n'a été trouvée. Indique clairement que la recherche n'a pas abouti et suggère des pistes alternatives."
      : ''

  const userPrompt = `Question: "${state.query}"
${sourcesReference}
${ragContext}
${jurisprudenceContext}
${legislationContext}
${searchSummary}

Génère une réponse complète avec des citations inline [#source_id].${noResultsWarning}`

  try {
    const finalModel = await getMainModel()
    const response = await finalModel.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    const answer = response.content.toString().trim()

    return {
      answer,
      sources,
      inputTokens:
        state.inputTokens + (response.usage_metadata?.input_tokens || 0),
      outputTokens:
        state.outputTokens + (response.usage_metadata?.output_tokens || 0),
    }
  } catch (error) {
    console.error('[BELGIAN-LAW-AGENT] Error generating response:', error)
    return {
      answer: `Une erreur s'est produite lors de la génération de la réponse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Router function to decide next step
 */
function shouldContinue(state: BelgianLawAgentState): string {
  // Check if we've reached max iterations
  if (state.iteration >= state.maxIterations) {
    console.log('[BELGIAN-LAW-AGENT] Max iterations reached, generating answer')
    return 'generate'
  }

  // Check if last action was final_answer
  const lastAction = state.actions[state.actions.length - 1]
  if (lastAction?.tool === 'final_answer') {
    console.log('[BELGIAN-LAW-AGENT] Final answer requested')
    return 'generate'
  }

  // Continue the loop
  return 'execute'
}

/**
 * Create the Belgian Law Agent Graph
 */
export function createBelgianLawAgentGraph() {
  const workflow = new StateGraph<BelgianLawAgentState>({
    channels: {
      query: null,
      userId: null,
      collectionId: null,
      sessionId: null,
      thoughts: null,
      actions: null,
      observations: null,
      iteration: null,
      maxIterations: null,
      searchCoverage: null,
      failedSearches: null,
      successfulSearches: null,
      toolCalls: null,
      ragResults: null,
      jurisprudenceResults: null,
      legislationResults: null,
      answer: null,
      sources: null,
      error: null,
      inputTokens: null,
      outputTokens: null,
    },
  })

  // Add nodes
  workflow.addNode('plan', planNextAction)
  workflow.addNode('execute', executeTool)
  workflow.addNode('generate', generateFinalResponse)

  // Flow: START -> plan -> (execute -> plan) loop or -> generate -> END
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge(START, 'plan' as any)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  workflow.addConditionalEdges('plan' as any, shouldContinue, {
    execute: 'execute',
    generate: 'generate',
  } as any)
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('execute' as any, 'plan' as any)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workflow.addEdge('generate' as any, END)

  return workflow.compile()
}

/**
 * Helper to create initial state
 */
export function createInitialState(
  query: string,
  userId: string,
  options?: {
    collectionId?: string
    sessionId?: string
    maxIterations?: number
  }
): BelgianLawAgentState {
  return {
    query,
    userId,
    collectionId: options?.collectionId,
    sessionId: options?.sessionId,
    thoughts: [],
    actions: [],
    observations: [],
    iteration: 0,
    maxIterations: options?.maxIterations || 15, // Increased for comprehensive search
    searchCoverage: {
      ragQueries: [],
      juportalQueries: [],
      moniteurQueries: [],
      ragResultCount: 0,
      juportalResultCount: 0,
      moniteurResultCount: 0,
    },
    failedSearches: [],
    successfulSearches: [],
    toolCalls: [],
    ragResults: [],
    jurisprudenceResults: [],
    legislationResults: [],
    answer: '',
    sources: [],
    inputTokens: 0,
    outputTokens: 0,
  }
}
