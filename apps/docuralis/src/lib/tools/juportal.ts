/**
 * JUPORTAL Belgian Jurisprudence Search Tool
 *
 * TypeScript implementation for searching Belgian legal cases on juportal.be.
 * Uses the RSS feed endpoint for reliable structured data.
 *
 * Boolean Search Operators:
 *   +  : word MUST be present (AND)
 *   -  : word must NOT be present (NOT)
 *   "  : search exact phrase
 *   *  : wildcard, matches any characters
 *   () : group expressions
 *   <  : word is less important
 *   >  : word is more important
 *
 * Examples:
 *   +"force majeure" +("droit fiscal" <"droit pénal")
 *   +(cause* causal*) +erreur +dommage
 */

import * as zlib from 'zlib'
import { promisify } from 'util'
import {
  ToolDefinition,
  ToolResult,
  JurisprudenceDocument,
  JurisprudenceSearchResult,
  BELGIAN_COURTS,
} from './types'

const deflate = promisify(zlib.deflate)
const inflate = promisify(zlib.inflate)

// Tool Definition for LLM
export const juportalSearchToolDefinition: ToolDefinition = {
  name: 'search_juportal',
  description: `Search Belgian jurisprudence on JUPORTAL (juportal.be).
Returns court decisions from Belgian courts including:
- Constitutional Court (Cour constitutionnelle)
- Court of Cassation (Cour de cassation)
- Council of State (Conseil d'État)
- Courts of Appeal
- Labour Courts
- First Instance Courts

Use boolean operators for precise searches:
- +word: word MUST be present
- -word: word must NOT be present
- "phrase": exact phrase
- word*: wildcard
- (a b): either a OR b`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query with optional boolean operators (+, -, "", *, ())',
      },
      courts: {
        type: 'array',
        description:
          'Filter by court codes: CASS (Cassation), RVSCE (Conseil État), GHCC (Const. Court), CABRL (Bruxelles), etc.',
        items: { type: 'string' },
      },
      dateFrom: {
        type: 'string',
        description: 'Start date (YYYY-MM-DD format)',
      },
      dateTo: {
        type: 'string',
        description: 'End date (YYYY-MM-DD format)',
      },
      languages: {
        type: 'array',
        description: 'Languages to search: FR, NL, DE',
        items: { type: 'string' },
        default: ['FR', 'NL', 'DE'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 20)',
        default: 20,
      },
    },
    required: ['query'],
  },
}

interface JuportalSearchParams {
  query: string
  courts?: string[]
  dateFrom?: string
  dateTo?: string
  languages?: string[]
  limit?: number
}

// Enums for search options
type SearchMode = 'BOOLEAN' | 'NATURAL'
type SearchOperator = 'AND' | 'OR'
type SortBy = 'SCORE' | 'NBCONS' | 'DATEDEC' | 'DATEPUB' | 'ECLI'
type SortOrder = 'DESC' | 'ASC'

interface SearchOptions {
  query: string
  searchInText?: boolean
  searchInKeywords?: boolean
  searchInAbstract?: boolean
  searchInNotes?: boolean
  langDutch?: boolean
  langFrench?: boolean
  langGerman?: boolean
  dateFrom?: string
  dateTo?: string
  mode?: SearchMode
  operator?: SearchOperator
  sortBy?: SortBy
  sortOrder?: SortOrder
  maxResults?: number
}

/**
 * PHP-style serialization for a value
 * IMPORTANT: PHP uses byte length for strings, not character length!
 */
function phpSerializeValue(value: unknown): string {
  if (typeof value === 'string') {
    // PHP uses byte length, not character length (important for UTF-8!)
    const byteLength = Buffer.byteLength(value, 'utf-8')
    return `s:${byteLength}:"${value}";`
  } else if (typeof value === 'boolean') {
    return `b:${value ? 1 : 0};`
  } else if (typeof value === 'number' && Number.isInteger(value)) {
    return `i:${value};`
  } else if (typeof value === 'number') {
    return `d:${value};`
  } else if (Array.isArray(value)) {
    if (value.length === 0) {
      return 'a:0:{}'
    }
    const items = value.map((v, i) => `i:${i};${phpSerializeValue(v)}`).join('')
    return `a:${value.length}:{${items}}`
  } else if (value === null || value === undefined) {
    return 'N;'
  } else {
    const str = String(value)
    const byteLength = Buffer.byteLength(str, 'utf-8')
    return `s:${byteLength}:"${str}";`
  }
}

/**
 * PHP-style serialization for an object/dictionary
 */
function phpSerializeArray(items: Record<string, unknown>): string {
  const entries = Object.entries(items)
  const serializedItems = entries
    .map(([key, value]) => {
      // PHP uses byte length for keys too
      const keyByteLength = Buffer.byteLength(key, 'utf-8')
      const keyStr = `s:${keyByteLength}:"${key}";`
      const valueStr = phpSerializeValue(value)
      return keyStr + valueStr
    })
    .join('')
  return `a:${entries.length}:{${serializedItems}}`
}

/**
 * Format query with boolean operators
 */
function formatQuery(query: string, operator: SearchOperator = 'AND'): string {
  const trimmed = query.trim()
  if (!trimmed) return ''

  // If using AND mode and query doesn't have explicit operators
  if (operator === 'AND') {
    const words = trimmed.split(/\s+/)
    const formatted = words.map((word) => {
      // Don't add + if already has operator or is quoted/grouped
      if (
        !word.startsWith('+') &&
        !word.startsWith('-') &&
        !word.startsWith('"') &&
        !word.startsWith('(') &&
        !word.startsWith('<') &&
        !word.startsWith('>') &&
        !word.startsWith('~')
      ) {
        return `+${word}`
      }
      return word
    })
    return ' ' + formatted.join(' ')
  }

  return ' ' + trimmed
}

/**
 * Build PHP search parameters
 */
function buildSearchParams(options: SearchOptions): Record<string, unknown> {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, '')
    .slice(0, 14)

  return {
    CRITTEXPRESSION: formatQuery(options.query, options.operator || 'AND'),
    CRITTRECHTEXTE: options.searchInText !== false ? 'on' : '',
    CRITTRECHECLITITRE: '',
    CRITTRECHMOCLELIB: options.searchInKeywords !== false ? 'on' : '',
    CRITTRECHRESUME: options.searchInAbstract !== false ? 'on' : '',
    CRITTRECHNOTE: options.searchInNotes !== false ? 'on' : '',
    CRITTRECHPUBLIC: '',
    CRITTRECHLANGNL: options.langDutch !== false ? 'on' : '',
    CRITTRECHLANGFR: options.langFrench !== false ? 'on' : '',
    CRITTRECHLANGDE: options.langGerman !== false ? 'on' : '',
    CRITTRECHFIELDLAW: [],
    CRITTRECHECLITYPEDEC: [],
    CRITTRECHJUSTELJURID: [],
    CRITTRECHSELANNEE: [],
    CRITTRECHECLINUMERO: '',
    CRITTRECHECLICOUR: '',
    CRITTRECHECLIANNEE: '',
    CRITTRECHECLIORDRE: '',
    CRITTRECHECLIADDLINK: '',
    CRITTRECHNOROLE: '',
    CRITTRECHDECISIONDE: options.dateFrom || '',
    CRITTRECHDECISIONA: options.dateTo || '',
    CRITTRECHPUBLICATDE: '',
    CRITTRECHPUBLICATA: '',
    CRITTRECHTHESCAS1: [],
    CRITTRECHTHESCASID: [],
    CRITTRECHTHESUTU1: [],
    CRITTRECHTHESUTUID: [],
    CRITTRECHBASELEGALE: [],
    CRITTRECHBASELEGDATE: '',
    CRITTRECHBASELEGNUM: '',
    CRITTRECHBASELEGART: '',
    CRITTRECHMODE: options.mode || 'BOOLEAN',
    CRITTRECHOPER: options.operator || 'AND',
    CRITTRECHSCORE: '0',
    CRITTRECHLIMIT: String(options.maxResults || 25000),
    CRITTRECHNPPAGE: '50',
    CRITTRECHBALLOON: '',
    CRITTRECHHILIGHT: 'on',
    CRITTRECHSHOWRESUME: 'on',
    CRITTRECHSHOWTHECAS: 'on',
    CRITTRECHSHOWTHEUTU: 'on',
    CRITTRECHSHOWMOTLIB: 'on',
    CRITTRECHSHOWBASLEG: '',
    CRITTRECHSHOWFICHES: 'ALL',
    CRITTRECHORDER: options.sortBy || 'SCORE',
    CRITTRECHDESCASC: options.sortOrder || 'DESC',
    FILTRE_CHECKECLICOUR: [],
    FILTRE_CHECKECLITYPEDOC: [],
    FILTRE_CHECKECLIANNEE: [],
    FILTRE_CHECKFIELDLAW: [],
    CRITTRECHLANGUE: 'FR',
    CRITTRECHNOM: `JUPORTARECH_${timestamp}`,
  }
}

/**
 * Generate RSS feed URL
 */
async function generateRssUrl(options: SearchOptions): Promise<string> {
  const params = buildSearchParams(options)
  const serialized = phpSerializeArray(params)

  // Compress with zlib
  const compressed = await deflate(Buffer.from(serialized, 'utf-8'))

  // Base64 encode (NO URL encoding - JUPORTAL expects raw base64)
  const encoded = compressed.toString('base64')

  return `https://juportal.be/moteur/Flux-RSS.rss?${encoded}`
}

/**
 * Fetch URL using native https module (more reliable than fetch for some servers)
 */
async function fetchWithHttps(url: string): Promise<string> {
  const https = await import('https')

  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml, */*',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        },
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          console.log('[JUPORTAL] HTTPS response status:', res.statusCode)
          console.log(
            '[JUPORTAL] HTTPS response headers:',
            JSON.stringify(res.headers)
          )
          resolve(data)
        })
      }
    )

    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}

/**
 * Clean HTML from text and decode entities
 */
function cleanHtml(text: string): string {
  if (!text) return ''

  // Decode HTML entities
  let cleaned = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ')

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

/**
 * Parse RSS date format
 */
function parseRssDate(dateStr: string): string {
  if (!dateStr) return ''

  // RSS format: "Thu, 25 Oct 01 00:00:00 +0000"
  const match = dateStr.match(/(\d+)\s+(\w+)\s+(\d+)/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const monthNames: Record<string, string> = {
      Jan: '01',
      Feb: '02',
      Mar: '03',
      Apr: '04',
      May: '05',
      Jun: '06',
      Jul: '07',
      Aug: '08',
      Sep: '09',
      Oct: '10',
      Nov: '11',
      Dec: '12',
    }
    const month = monthNames[match[2]] || '01'
    let year = match[3]
    if (year.length === 2) {
      year = parseInt(year) > 50 ? `19${year}` : `20${year}`
    }
    return `${day}/${month}/${year}`
  }

  return dateStr
}

/**
 * Extract role number from description
 */
function extractRoleNumber(description: string): string {
  const match = description.match(/([A-Z]\.\d{2}\.\d{4}\.[A-Z])/)
  return match ? match[1] : ''
}

/**
 * Parse RSS feed XML
 */
function parseRssFeed(xmlContent: string): {
  totalCount: number
  documents: JurisprudenceDocument[]
} {
  const documents: JurisprudenceDocument[] = []

  // Extract items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xmlContent)) !== null) {
    const itemXml = match[1]

    // Extract fields
    const titleMatch = itemXml.match(/<title>([^<]*)<\/title>/)
    const ecli = titleMatch ? titleMatch[1].trim() : ''

    if (!ecli.startsWith('ECLI:')) continue

    const authorMatch = itemXml.match(/<author>([^<]*)<\/author>/)
    const courtName = authorMatch ? cleanHtml(authorMatch[1]) : ''

    // Note: JUPORTAL has typo "pudDate"
    const dateMatch = itemXml.match(
      /<(?:pubDate|pudDate)>([^<]*)<\/(?:pubDate|pudDate)>/
    )
    const decisionDate = dateMatch ? parseRssDate(dateMatch[1]) : ''

    const categoryMatch = itemXml.match(/<category>([^<]*)<\/category>/)
    const category = categoryMatch ? categoryMatch[1].trim() : ''

    const linkMatch = itemXml.match(/<link>([^<]*)<\/link>/)
    const url = linkMatch ? linkMatch[1].trim() : ''

    const descMatch = itemXml.match(/<description>([^<]*)<\/description>/)
    const rawDescription = descMatch ? descMatch[1] : ''
    const description = cleanHtml(rawDescription)

    // Detect language from URL
    let language = 'FR'
    if (url.includes('/NL?') || url.includes('/NL/')) language = 'NL'
    else if (url.includes('/DE?') || url.includes('/DE/')) language = 'DE'

    // Extract role number
    const roleNumber = extractRoleNumber(description)

    // Extract ECLI parts
    const ecliParts = ecli.split(':')
    const courtCode = ecliParts.length > 2 ? ecliParts[2] : ''

    // Extract keywords from description (uppercase sections)
    const thesaurusCas: string[] = []
    const keywordMatch = description.match(
      /[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ][A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ\s'\-()]+(?:\.[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜ\s'\-]+)*/g
    )
    if (keywordMatch) {
      keywordMatch.forEach((kw) => {
        const cleaned = kw.trim()
        if (cleaned.length > 3 && cleaned.length < 100) {
          thesaurusCas.push(cleaned)
        }
      })
    }

    documents.push({
      ecli,
      courtCode,
      courtName: courtName || BELGIAN_COURTS[courtCode] || courtCode,
      decisionDate,
      roleNumber,
      summary: description.slice(0, 500),
      thesaurusCas: [...new Set(thesaurusCas)].slice(0, 10),
      thesaurusUtu: [],
      keywords: [],
      consultationCount: 0,
      url,
      iubelId: '',
      language,
    })
  }

  return {
    totalCount: documents.length,
    documents,
  }
}

/**
 * Execute JUPORTAL search via RSS feed
 */
export async function executeJuportalSearch(
  params: JuportalSearchParams
): Promise<ToolResult<JurisprudenceSearchResult>> {
  const startTime = Date.now()
  const {
    query,
    dateFrom,
    dateTo,
    languages = ['FR', 'NL', 'DE'],
    limit = 20,
  } = params

  console.log('[JUPORTAL] Executing search:', {
    query,
    dateFrom,
    dateTo,
    languages,
    limit,
  })

  try {
    // Build search options
    const searchOptions: SearchOptions = {
      query,
      langFrench: languages.includes('FR'),
      langDutch: languages.includes('NL'),
      langGerman: languages.includes('DE'),
      dateFrom,
      dateTo,
      operator: 'AND',
      mode: 'BOOLEAN',
      sortBy: 'DATEDEC', // Sort by decision date (most recent first)
      sortOrder: 'DESC',
      maxResults: Math.max(limit * 2, 100), // Get more than needed for filtering
    }

    // Generate RSS URL
    console.log('[JUPORTAL] Generating RSS URL...')
    const rssUrl = await generateRssUrl(searchOptions)
    console.log('[JUPORTAL] RSS URL:', rssUrl.slice(0, 80) + '...')

    // Fetch RSS feed using native https (more reliable)
    console.log('[JUPORTAL] Fetching RSS feed...')
    console.log('[JUPORTAL] Full URL:', rssUrl)

    const xmlContent = await fetchWithHttps(rssUrl)
    console.log('[JUPORTAL] RSS response size:', xmlContent.length, 'bytes')

    if (xmlContent.length > 0) {
      console.log('[JUPORTAL] Response preview:', xmlContent.slice(0, 300))
    }

    // Check for empty or error response
    if (xmlContent.length < 100) {
      console.log('[JUPORTAL] Response too short:', xmlContent)
      throw new Error('Empty or invalid RSS response')
    }

    // Parse RSS feed
    const { totalCount, documents } = parseRssFeed(xmlContent)

    // Limit results
    const limitedDocs = documents.slice(0, limit)

    const durationMs = Date.now() - startTime
    console.log(
      `[JUPORTAL] Search completed: ${limitedDocs.length}/${totalCount} results in ${durationMs}ms`
    )

    // Log first few results
    if (limitedDocs.length > 0) {
      console.log('[JUPORTAL] First results:')
      limitedDocs.slice(0, 3).forEach((doc, i) => {
        console.log(
          `  ${i + 1}. ${doc.ecli} - ${doc.courtName} (${doc.decisionDate})`
        )
      })
    }

    return {
      success: true,
      data: {
        query,
        totalCount,
        documents: limitedDocs,
        fetchedAt: new Date().toISOString(),
        source: 'juportal',
      },
      metadata: {
        durationMs,
        source: 'juportal.be',
        itemCount: limitedDocs.length,
      },
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('[JUPORTAL] Search failed:', errorMessage)

    return {
      success: false,
      error: errorMessage,
      metadata: {
        durationMs,
        source: 'juportal.be',
      },
    }
  }
}

/**
 * Get available court codes
 */
export function getAvailableCourts(): Record<string, string> {
  return { ...BELGIAN_COURTS }
}

/**
 * Fetch full content of a jurisprudence decision from JuPortal
 * @param ecli ECLI number (e.g., "ECLI:BE:CASS:2024:ARR.0123")
 * @param url Optional direct URL to the decision
 */
export async function fetchJurisprudenceContent(
  ecli: string,
  url?: string
): Promise<
  ToolResult<{
    ecli: string
    fullText: string
    summary?: string
    courtName?: string
    decisionDate?: string
    legalBasis?: string[]
  }>
> {
  const startTime = Date.now()

  console.log('[JUPORTAL] Fetching full content for:', ecli)

  try {
    // Build URL from ECLI if not provided
    let fetchUrl = url
    if (!fetchUrl) {
      // JuPortal URL format: https://juportal.be/JUPORTArest/ecli/ECLI:BE:...?lg=FR
      fetchUrl = `https://juportal.be/JUPORTArest/ecli/${encodeURIComponent(ecli)}?lg=FR`
    }

    console.log('[JUPORTAL] Fetching URL:', fetchUrl)

    // Try REST API first (returns JSON)
    const restUrl = `https://juportal.be/JUPORTArest/ecli/${encodeURIComponent(ecli)}?lg=FR`

    try {
      const response = await fetch(restUrl, {
        headers: {
          Accept: 'application/json, text/html',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      })

      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''

        if (contentType.includes('application/json')) {
          const json = await response.json()
          console.log('[JUPORTAL] REST API response keys:', Object.keys(json))

          // Extract text from JSON response
          const fullText = json.texte || json.text || json.content || ''
          const summary = json.resume || json.summary || json.abstract || ''
          const courtName = json.juridiction || json.court || ''
          const decisionDate = json.dateDecision || json.date || ''
          const legalBasis = json.basesLegales || json.legalBasis || []

          if (fullText) {
            return {
              success: true,
              data: {
                ecli,
                fullText: cleanHtml(fullText).slice(0, 10000), // Limit to 10k chars
                summary: cleanHtml(summary),
                courtName,
                decisionDate,
                legalBasis: Array.isArray(legalBasis) ? legalBasis : [],
              },
              metadata: {
                durationMs: Date.now() - startTime,
                source: 'juportal.be',
              },
            }
          }
        }
      }
    } catch (restError) {
      console.log('[JUPORTAL] REST API failed, trying HTML:', restError)
    }

    // Fallback: Fetch HTML page
    const htmlUrl =
      url || `https://juportal.be/content/${encodeURIComponent(ecli)}?lng=fr`
    console.log('[JUPORTAL] Fetching HTML:', htmlUrl)

    const htmlResponse = await fetch(htmlUrl, {
      headers: {
        Accept: 'text/html',
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      redirect: 'follow',
    })

    if (!htmlResponse.ok) {
      throw new Error(`HTTP ${htmlResponse.status}`)
    }

    const html = await htmlResponse.text()
    console.log('[JUPORTAL] HTML response size:', html.length)

    // Extract decision text from HTML
    // Look for common patterns in JuPortal pages
    let fullText = ''
    let summary = ''

    // Pattern 1: <div class="texte">...</div> or <div id="texte">...</div>
    const texteDivMatch = html.match(
      /<div[^>]*(?:class|id)="texte"[^>]*>([\s\S]*?)<\/div>/i
    )
    if (texteDivMatch) {
      fullText = cleanHtml(texteDivMatch[1])
    }

    // Pattern 2: <section class="decision">...</section>
    if (!fullText) {
      const sectionMatch = html.match(
        /<section[^>]*class="decision"[^>]*>([\s\S]*?)<\/section>/i
      )
      if (sectionMatch) {
        fullText = cleanHtml(sectionMatch[1])
      }
    }

    // Pattern 3: <article>...</article>
    if (!fullText) {
      const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
      if (articleMatch) {
        fullText = cleanHtml(articleMatch[1])
      }
    }

    // Pattern 4: Look for the main content area
    if (!fullText) {
      const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
      if (mainMatch) {
        fullText = cleanHtml(mainMatch[1])
      }
    }

    // Pattern 5: Just extract body content
    if (!fullText) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      if (bodyMatch) {
        fullText = cleanHtml(bodyMatch[1]).slice(0, 10000)
      }
    }

    // Extract summary/resume
    const resumeMatch = html.match(
      /<div[^>]*class="resume"[^>]*>([\s\S]*?)<\/div>/i
    )
    if (resumeMatch) {
      summary = cleanHtml(resumeMatch[1])
    }

    // Extract court name
    const courtMatch = html.match(
      /<span[^>]*class="juridiction"[^>]*>([^<]+)<\/span>/i
    )
    const courtName = courtMatch ? cleanHtml(courtMatch[1]) : ''

    // Extract date
    const dateMatch = html.match(/<span[^>]*class="date"[^>]*>([^<]+)<\/span>/i)
    const decisionDate = dateMatch ? cleanHtml(dateMatch[1]) : ''

    if (!fullText && html.length > 500) {
      // Last resort: return a portion of the cleaned HTML
      fullText = cleanHtml(html).slice(0, 5000)
    }

    if (!fullText) {
      return {
        success: false,
        error: 'Could not extract content from jurisprudence page',
        metadata: {
          durationMs: Date.now() - startTime,
          source: 'juportal.be',
        },
      }
    }

    return {
      success: true,
      data: {
        ecli,
        fullText: fullText.slice(0, 10000),
        summary,
        courtName,
        decisionDate,
        legalBasis: [],
      },
      metadata: {
        durationMs: Date.now() - startTime,
        source: 'juportal.be',
      },
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('[JUPORTAL] Error fetching content:', errorMessage)

    return {
      success: false,
      error: errorMessage,
      metadata: {
        durationMs: Date.now() - startTime,
        source: 'juportal.be',
      },
    }
  }
}
