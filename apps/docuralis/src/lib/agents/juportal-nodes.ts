import { ChatOpenAI } from '@langchain/openai'
import { v4 as uuidv4 } from 'uuid'
import type { ToolCallInfo } from './types'
import { executeJuportalSearch } from '../tools/juportal'

/**
 * JUPORTAL Agent State - specialized for jurisprudence search only
 */
export interface JuportalAgentState {
  query: string
  userId: string
  sessionId?: string

  // Tool calls tracking
  toolCalls: ToolCallInfo[]

  // Search results
  jurisprudence: JurisprudenceResult[]

  // Response
  answer: string

  // Metadata
  error?: string
  inputTokens: number
  outputTokens: number
}

export interface JurisprudenceResult {
  ecli: string
  courtName: string
  decisionDate: string
  roleNumber: string
  summary: string
  url: string
  thesaurusCas: string[]
  score: number
}

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
})

/**
 * Use LLM to generate optimal JUPORTAL search queries
 * Returns 2-3 focused queries that are likely to find relevant jurisprudence
 */
async function generateJuportalQueries(
  userQuestion: string
): Promise<string[]> {
  try {
    const response = await model.invoke([
      {
        role: 'system',
        content: `Tu es un expert en recherche de jurisprudence belge sur JUPORTAL.

MISSION: Générer 2-3 requêtes de recherche OPTIMALES pour trouver la jurisprudence pertinente.

RÈGLES CRITIQUES:
1. Chaque requête: 2-3 mots-clés juridiques PRÉCIS (pas plus!)
2. ÉVITE ABSOLUMENT: "code", "article", "loi", "droit", "sociétés", "associations", "procédure", "judiciaire"
3. PRIVILÉGIE les termes juridiques techniques:
   - Types de contrats: "bail", "vente", "mandat", "prêt"
   - Concepts: "nullité", "résiliation", "compétence", "prescription"
   - Juridictions: "juge paix", "tribunal", "cassation"
4. Pour questions de COMPÉTENCE: utilise "compétence" + nom de juridiction
5. Pour questions de NULLITÉ: utilise "nullité" + type d'acte

EXEMPLES DE BONNES REQUÊTES:
- Compétence juge de paix pour bail → ["compétence juge paix", "bail commercial tribunal"]
- Nullité contrat société → ["nullité convention", "vice consentement société"]
- Responsabilité mandataire → ["responsabilité mandataire", "faute gestion"]

EXEMPLES DE MAUVAISES REQUÊTES (À ÉVITER):
- "code sociétés associations" ❌ (trop générique)
- "article nullité contrat" ❌ (article = bruit)
- "procédure judiciaire compétence" ❌ (procédure/judiciaire = bruit)

FORMAT: JSON array de 2-3 strings courtes.`,
      },
      {
        role: 'user',
        content: `Question: "${userQuestion}"

Génère 2-3 requêtes COURTES et PRÉCISES (2-3 mots chacune).
Réponds UNIQUEMENT avec un JSON array.`,
      },
    ])

    const content = response.content.toString().trim()

    // Parse JSON response
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const queries = JSON.parse(jsonMatch[0]) as string[]
      console.log('[JUPORTAL-AGENT] LLM generated queries:', queries)
      return queries.slice(0, 3)
    }

    // Fallback: extract keywords manually
    console.log('[JUPORTAL-AGENT] LLM response not JSON, using fallback')
    return [extractLegalKeywords(userQuestion)]
  } catch (error) {
    console.error('[JUPORTAL-AGENT] Error generating queries:', error)
    return [extractLegalKeywords(userQuestion)]
  }
}

/**
 * Extract legal keywords from a query for JUPORTAL search (fallback)
 * Prioritizes legal domain terms and common legal concepts
 */
function extractLegalKeywords(query: string): string {
  // Common legal phrases to look for (will be kept together)
  const legalPhrases = [
    'bail commercial',
    'bail résidentiel',
    'bail à ferme',
    'droit civil',
    'droit pénal',
    'droit fiscal',
    'droit social',
    'code civil',
    'code pénal',
    'code judiciaire',
    'code des sociétés',
    'code sociétés',
    'juge de paix',
    'juge paix',
    'tribunal de commerce',
    'tribunal commerce',
    "cour d'appel",
    'cour appel',
    'cour cassation',
    "conseil d'état",
    'conseil état',
    'action paulienne',
    'action oblique',
    'responsabilité civile',
    'responsabilité contractuelle',
    'nullité contrat',
    'nullité',
    'force majeure',
    'cas fortuit',
    'bonne foi',
    'mauvaise foi',
    'préjudice',
    'dommages intérêts',
    'dommages-intérêts',
    'compétence matérielle',
    'compétence territoriale',
    'prescription',
    'délai',
  ]

  const lowerQuery = query.toLowerCase()
  const foundPhrases: string[] = []

  // Find legal phrases in query
  for (const phrase of legalPhrases) {
    if (lowerQuery.includes(phrase)) {
      foundPhrases.push(phrase)
    }
  }

  // Legal domain words (high priority single words)
  const legalWords = new Set([
    'contrat',
    'bail',
    'loyer',
    'locataire',
    'bailleur',
    'propriétaire',
    'société',
    'sociétés',
    'association',
    'asbl',
    'sprl',
    'sa',
    'srl',
    'nullité',
    'annulation',
    'résiliation',
    'résolution',
    'compétence',
    'juridiction',
    'tribunal',
    'cour',
    'juge',
    'responsabilité',
    'faute',
    'négligence',
    'préjudice',
    'dommage',
    'créancier',
    'débiteur',
    'dette',
    'créance',
    'paiement',
    'prescription',
    'délai',
    'forclusion',
    'preuve',
    'témoin',
    'témoignage',
    'aveu',
    'appel',
    'cassation',
    'pourvoi',
    'recours',
    'exécution',
    'saisie',
    'hypothèque',
    'gage',
    'succession',
    'héritage',
    'testament',
    'donation',
    'mariage',
    'divorce',
    'séparation',
    'pension',
    'travail',
    'licenciement',
    'démission',
    'préavis',
    'infraction',
    'délit',
    'crime',
    'amende',
    'peine',
  ])

  // Stop words to exclude
  const stopWords = new Set([
    'comment',
    'quelles',
    'quelle',
    'quel',
    'quels',
    'sont',
    'est',
    'les',
    'des',
    'une',
    'un',
    'dans',
    'pour',
    'avec',
    'sur',
    'par',
    'entre',
    'autres',
    'comme',
    'être',
    'avoir',
    'faire',
    'peut',
    'peuvent',
    'doit',
    'doivent',
    'quand',
    'pourquoi',
    'qui',
    'que',
    'cette',
    'ces',
    'cet',
    'ce',
    'la',
    'le',
    'et',
    'ou',
    'de',
    'du',
    'au',
    'aux',
    'en',
    'se',
    'sa',
    'son',
    'ses',
    'leur',
    'leurs',
    'cadre',
    'procédure',
    'judiciaire',
    'tendant',
    'demander',
    'article',
    'paragraphe',
    'alinéa',
    'matériellement',
  ])

  // Extract words from query
  const words = lowerQuery
    .replace(/[.,;:'"«»()[\]{}§]/g, ' ')
    .replace(/\d+/g, ' ') // Remove article numbers
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))

  // Prioritize legal words
  const priorityWords = words.filter((w) => legalWords.has(w))
  const otherWords = words.filter(
    (w) => !legalWords.has(w) && !stopWords.has(w)
  )

  // Build final keywords: phrases first, then priority words, then others
  const keywords: string[] = [...foundPhrases]

  for (const word of priorityWords) {
    if (!keywords.some((k) => k.includes(word))) {
      keywords.push(word)
    }
    if (keywords.length >= 4) break
  }

  // Add other words if needed
  if (keywords.length < 3) {
    for (const word of otherWords) {
      if (!keywords.some((k) => k.includes(word)) && word.length > 4) {
        keywords.push(word)
      }
      if (keywords.length >= 3) break
    }
  }

  if (keywords.length === 0) {
    // Fallback: take first 3 meaningful words
    return words.slice(0, 3).join(' ')
  }

  // Return space-separated keywords (JUPORTAL will add + operators)
  return keywords.slice(0, 4).join(' ')
}

/**
 * Search JUPORTAL for Belgian jurisprudence
 * Uses LLM to generate optimal queries and merges results
 */
export async function searchJuportal(
  state: JuportalAgentState
): Promise<Partial<JuportalAgentState>> {
  const toolCalls: ToolCallInfo[] = [...(state.toolCalls || [])]

  const toolCall: ToolCallInfo = {
    id: uuidv4(),
    name: 'search_juportal',
    status: 'running',
    startedAt: new Date().toISOString(),
    args: { query: state.query },
  }
  toolCalls.push(toolCall)

  console.log(`[JUPORTAL-AGENT] Starting search for: "${state.query}"`)

  try {
    const startTime = Date.now()

    // Use LLM to generate optimal search queries
    const searchQueries = await generateJuportalQueries(state.query)
    console.log(
      `[JUPORTAL-AGENT] Generated ${searchQueries.length} queries:`,
      searchQueries
    )
    toolCall.args = { query: state.query, searchQueries }

    // Execute all queries and collect results
    const allDocuments: Map<string, JurisprudenceResult> = new Map()

    for (const query of searchQueries) {
      console.log(`[JUPORTAL-AGENT] Searching: "${query}"`)

      const result = await executeJuportalSearch({
        query,
        limit: 15, // Get 15 per query, will dedupe
        languages: ['FR', 'NL', 'DE'],
      })

      if (result.success && result.data?.documents.length) {
        console.log(
          `[JUPORTAL-AGENT] Query "${query}" returned ${result.data.documents.length} results`
        )

        // Add to map, using ECLI as key for deduplication
        for (const doc of result.data.documents) {
          if (!allDocuments.has(doc.ecli)) {
            allDocuments.set(doc.ecli, {
              ecli: doc.ecli,
              courtName: doc.courtName,
              decisionDate: doc.decisionDate,
              roleNumber: doc.roleNumber,
              summary: doc.summary || '',
              url: doc.url,
              thesaurusCas: doc.thesaurusCas || [],
              score: doc.score || 0.8,
            })
          }
        }
      } else {
        console.log(`[JUPORTAL-AGENT] Query "${query}" returned no results`)
      }
    }

    // If no results from LLM queries, try fallback with extracted keywords
    if (allDocuments.size === 0) {
      const fallbackKeywords = extractLegalKeywords(state.query)
      console.log(
        `[JUPORTAL-AGENT] No LLM results, fallback to: "${fallbackKeywords}"`
      )

      const result = await executeJuportalSearch({
        query: fallbackKeywords,
        limit: 20,
        languages: ['FR', 'NL', 'DE'],
      })

      if (result.success && result.data?.documents.length) {
        for (const doc of result.data.documents) {
          allDocuments.set(doc.ecli, {
            ecli: doc.ecli,
            courtName: doc.courtName,
            decisionDate: doc.decisionDate,
            roleNumber: doc.roleNumber,
            summary: doc.summary || '',
            url: doc.url,
            thesaurusCas: doc.thesaurusCas || [],
            score: doc.score || 0.8,
          })
        }
      }
    }

    toolCall.durationMs = Date.now() - startTime
    toolCall.completedAt = new Date().toISOString()

    // Court priority for civil law questions (higher = more relevant for most queries)
    const courtPriority: Record<string, number> = {
      'Cour de cassation': 100,
      'Hof van Cassatie': 100,
      'Cour constitutionnelle': 90,
      "Cour constitutionnelle (Cour d'arbitrage)": 90,
      'Grondwettelijk Hof': 90,
      "Cour d'appel": 80,
      'Hof van beroep': 80,
      'Tribunal de première instance': 70,
      'Rechtbank van eerste aanleg': 70,
      'Tribunal de commerce': 70,
      Ondernemingsrechtbank: 70,
      'Tribunal du travail': 60,
      Arbeidsrechtbank: 60,
      'Justice de paix': 85, // High priority for juge de paix questions!
      Vredegerecht: 85,
      "Conseil d'État": 30, // Lower priority for civil questions
      'Raad van State': 30,
    }

    const getCourtPriority = (courtName: string): number => {
      // Direct match
      if (courtPriority[courtName]) return courtPriority[courtName]
      // Partial match
      for (const [key, value] of Object.entries(courtPriority)) {
        if (courtName.toLowerCase().includes(key.toLowerCase())) return value
      }
      return 50 // Default priority
    }

    // Parse date helper
    const parseDate = (d: string) => {
      const parts = d.split('/')
      if (parts.length === 3) {
        return new Date(
          parseInt(parts[2]),
          parseInt(parts[1]) - 1,
          parseInt(parts[0])
        )
      }
      return new Date(0)
    }

    // Convert map to array and sort by court priority, then by date
    const jurisprudence = Array.from(allDocuments.values())
      .sort((a, b) => {
        // First sort by court priority (higher first)
        const priorityDiff =
          getCourtPriority(b.courtName) - getCourtPriority(a.courtName)
        if (priorityDiff !== 0) return priorityDiff
        // Then by date (most recent first)
        return (
          parseDate(b.decisionDate).getTime() -
          parseDate(a.decisionDate).getTime()
        )
      })
      .slice(0, 20) // Limit to 20 best results

    if (jurisprudence.length > 0) {
      toolCall.status = 'completed'
      toolCall.resultSummary = `Found ${jurisprudence.length} unique jurisprudence decisions from ${searchQueries.length} queries`

      console.log(
        `[JUPORTAL-AGENT] Found ${jurisprudence.length} unique results:`
      )
      jurisprudence.slice(0, 5).forEach((j, i) => {
        console.log(
          `  ${i + 1}. ${j.ecli} - ${j.courtName} (${j.decisionDate})`
        )
      })

      return {
        jurisprudence,
        toolCalls,
      }
    } else {
      toolCall.status = 'completed'
      toolCall.resultSummary = 'No jurisprudence found'

      console.log(`[JUPORTAL-AGENT] No results found for any query`)

      return {
        jurisprudence: [],
        toolCalls,
      }
    }
  } catch (error) {
    toolCall.status = 'error'
    toolCall.error = error instanceof Error ? error.message : 'Unknown error'
    toolCall.completedAt = new Date().toISOString()

    console.error(`[JUPORTAL-AGENT] Error: ${toolCall.error}`)

    return {
      jurisprudence: [],
      toolCalls,
      error: toolCall.error,
    }
  }
}

/**
 * Generate a response based on JUPORTAL results
 */
export async function generateJuportalResponse(
  state: JuportalAgentState
): Promise<Partial<JuportalAgentState>> {
  try {
    if (!state.jurisprudence.length) {
      return {
        answer: `Je n'ai pas trouvé de jurisprudence pertinente sur JUPORTAL pour votre question: "${state.query}".

Vous pouvez essayer:
- De reformuler votre question avec des termes juridiques plus précis
- De rechercher directement sur [JUPORTAL](https://juportal.be) avec différents mots-clés
- De consulter d'autres bases de données juridiques belges`,
      }
    }

    // Format jurisprudence for the prompt
    const jurisprudenceText = state.jurisprudence
      .slice(0, 10) // Top 10 results
      .map((j, i) => {
        return `**${i + 1}. ${j.ecli}**
- **Juridiction:** ${j.courtName}
- **Date:** ${j.decisionDate}
- **Numéro de rôle:** ${j.roleNumber || 'N/A'}
- **Résumé:** ${j.summary || 'Pas de résumé disponible'}
- **Mots-clés:** ${j.thesaurusCas.join(', ') || 'N/A'}
- **Lien:** [Voir la décision](${j.url})`
      })
      .join('\n\n')

    const systemPrompt = `Vous êtes un expert en droit belge spécialisé dans l'analyse de jurisprudence.
Votre rôle est de synthétiser les décisions de justice trouvées sur JUPORTAL et d'expliquer leur pertinence par rapport à la question posée.

RÈGLES:
- Répondez TOUJOURS en français
- Utilisez un formatage markdown clair
- Citez les décisions avec leur ECLI
- Expliquez comment chaque décision pertinente répond à la question
- Mentionnez la juridiction et la date de chaque décision citée
- Incluez les liens vers les décisions originales
- Si les décisions ne répondent pas directement à la question, indiquez-le clairement`

    const userPrompt = `Question de l'utilisateur: "${state.query}"

Jurisprudence trouvée sur JUPORTAL:

${jurisprudenceText}

Analysez ces décisions et répondez à la question en vous basant sur la jurisprudence belge.`

    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    let answer = response.content.toString().trim()

    // Add sources section at the end
    answer += `\n\n---\n\n## Sources JUPORTAL\n\n`
    state.jurisprudence.slice(0, 10).forEach((j, i) => {
      answer += `${i + 1}. **[${j.ecli}](${j.url})** - ${j.courtName} (${j.decisionDate})\n`
    })

    return {
      answer,
      inputTokens: response.usage_metadata?.input_tokens || 0,
      outputTokens: response.usage_metadata?.output_tokens || 0,
    }
  } catch (error) {
    console.error('[JUPORTAL-AGENT] Error generating response:', error)
    return {
      answer: `Une erreur s'est produite lors de la génération de la réponse: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
