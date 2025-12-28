/**
 * Moniteur Belge / Justel Belgian Legislation Search Tool
 *
 * TypeScript implementation for searching Belgian legislation on ejustice.just.fgov.be.
 * Accesses the Justel database (consolidated Belgian law).
 *
 * Document Types:
 *   - LOI: Laws (Lois)
 *   - AR: Royal Decrees (Arrêtés Royaux)
 *   - AM: Ministerial Decrees (Arrêtés Ministériels)
 *   - DECRET: Decrees (regional)
 *   - ORDONNANCE: Ordinances (Brussels region)
 *   - CODE: Legal codes
 */

import { ToolDefinition, ToolResult } from './types'

// Tool Definition for LLM
export const moniteurBelgeSearchToolDefinition: ToolDefinition = {
  name: 'search_moniteur_belge',
  description: `Search Belgian legislation in the Moniteur Belge / Justel database.
Returns Belgian laws, decrees, royal orders, and other legal texts.

Types of documents available:
- LOI: Laws
- AR: Royal Decrees (Arrêtés Royaux)
- AM: Ministerial Decrees (Arrêtés Ministériels)
- DECRET: Regional Decrees
- ORDONNANCE: Brussels Ordinances
- CODE: Legal Codes

Use this tool to find:
- Current Belgian legislation
- Specific laws by topic or keyword
- Legal codes (Code civil, Code pénal, etc.)
- Recent legal modifications`,
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query - keywords to search in legislation titles and text',
      },
      documentType: {
        type: 'string',
        description: 'Type of document: LOI, AR, AM, DECRET, ORDONNANCE, CODE',
        enum: ['LOI', 'AR', 'AM', 'DECRET', 'ORDONNANCE', 'CODE', 'ALL'],
      },
      dateFrom: {
        type: 'string',
        description: 'Start date for promulgation (YYYY-MM-DD)',
      },
      dateTo: {
        type: 'string',
        description: 'End date for promulgation (YYYY-MM-DD)',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (default: 10)',
        default: 10,
      },
    },
    required: ['query'],
  },
}

export interface LegislationDocument {
  numac: string
  title: string
  documentType: string
  publicationDate: string
  promulgationDate?: string
  source: string
  url: string
  summary?: string
}

export interface LegislationSearchResult {
  query: string
  totalCount: number
  documents: LegislationDocument[]
  fetchedAt: string
  source: string
}

interface MoniteurBelgeSearchParams {
  query: string
  documentType?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}

const BASE_URL = 'https://www.ejustice.just.fgov.be'

/**
 * Parse date from Belgian format (DD-MM-YYYY) to ISO
 */
function parseBelgianDate(dateStr: string): string {
  if (!dateStr) return ''
  const parts = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (parts) {
    return `${parts[3]}/${parts[2]}/${parts[1]}`
  }
  return dateStr
}

/**
 * Clean HTML and decode entities
 */
function cleanHtml(text: string): string {
  if (!text) return ''

  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract NUMAC and other info from article links
 */
function parseListResults(html: string): LegislationDocument[] {
  const documents: LegislationDocument[] = []
  const seenNumacs = new Set<string>()

  // Pattern 1: Find article.pl links with numac_search parameter
  // Format: article.pl?language=fr&sum_date=&pd_search=2021-01-05&numac_search=2020044715...
  const linkRegex =
    /href="article\.pl\?[^"]*pd_search=(\d{4}-\d{2}-\d{2})[^"]*numac_search=(\d+)[^"]*"/gi

  let match
  while ((match = linkRegex.exec(html)) !== null) {
    const pubDate = match[1]
    const numac = match[2]

    if (numac && !seenNumacs.has(numac)) {
      seenNumacs.add(numac)

      // Try to find the title after this link
      const afterLink = html.slice(match.index, match.index + 1000)
      const titleMatch = afterLink.match(/>([^<]{10,200})</i)
      const title = titleMatch ? cleanHtml(titleMatch[1]) : `Document ${numac}`

      documents.push({
        numac,
        title: title || `Document ${numac}`,
        documentType: 'LOI',
        publicationDate: parseBelgianDate(pubDate),
        source: 'Justel',
        url: `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list`,
      })
    }
  }

  // Pattern 2: Alternative with numac_search before pd_search
  if (documents.length === 0) {
    const altRegex =
      /href="article\.pl\?[^"]*numac_search=(\d+)[^"]*pd_search=(\d{4}-\d{2}-\d{2})[^"]*"/gi

    while ((match = altRegex.exec(html)) !== null) {
      const numac = match[1]
      const pubDate = match[2]

      if (!seenNumacs.has(numac)) {
        seenNumacs.add(numac)

        const afterLink = html.slice(match.index, match.index + 1000)
        const titleMatch = afterLink.match(/>([^<]{10,200})</i)
        const title = titleMatch
          ? cleanHtml(titleMatch[1])
          : `Document ${numac}`

        documents.push({
          numac,
          title,
          documentType: 'LOI',
          publicationDate: parseBelgianDate(pubDate),
          source: 'Justel',
          url: `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list`,
        })
      }
    }
  }

  // Pattern 3: Simple numac extraction without date
  if (documents.length === 0) {
    const simpleRegex = /numac_search=(\d{10,})/gi
    while ((match = simpleRegex.exec(html)) !== null) {
      const numac = match[1]

      if (!seenNumacs.has(numac)) {
        seenNumacs.add(numac)
        documents.push({
          numac,
          title: `Document NUMAC ${numac}`,
          documentType: 'LOI',
          publicationDate: '',
          source: 'Justel',
          url: `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list`,
        })
      }
    }
  }

  return documents
}

/**
 * Fetch article details to get summary/content
 */
async function fetchArticleDetails(
  numac: string,
  docType: string = 'LOI'
): Promise<{ title?: string; summary?: string }> {
  try {
    const url = `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list&dt=${docType}`

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
    })

    if (!response.ok) return {}

    const html = await response.text()

    // Extract title
    const titleMatch = html.match(/class="list-item--title"[^>]*>([^<]+)</i)
    const title = titleMatch ? cleanHtml(titleMatch[1]) : undefined

    // Extract summary/text preview
    const textMatch = html.match(
      /<h2[^>]*id="text"[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([^<]{100,1000})/i
    )
    const summary = textMatch
      ? cleanHtml(textMatch[1]).slice(0, 500)
      : undefined

    return { title, summary }
  } catch (error) {
    console.error('[MONITEUR-BELGE] Error fetching article:', error)
    return {}
  }
}

/**
 * Parse results from the new list.pl HTML structure
 */
function parseNewListResults(html: string): LegislationDocument[] {
  const documents: LegislationDocument[] = []
  const seenNumacs = new Set<string>()

  // Pattern for the new HTML structure:
  // <a href="article.pl?...pd_search=YYYY-MM-DD&numac_search=NNNNANNNN..." class="list-item--title">TITLE</a>
  // Note: numac can include letters (e.g., 2022A32058)
  const listItemRegex =
    /<a\s+href="article\.pl\?[^"]*pd_search=(\d{4}-\d{2}-\d{2})[^"]*numac_search=([A-Z0-9]+)[^"]*"[^>]*class="list-item--title"[^>]*>\s*([^<]+)/gi

  let match
  while ((match = listItemRegex.exec(html)) !== null) {
    const pubDate = match[1]
    const numac = match[2]
    const title = cleanHtml(match[3])

    if (numac && !seenNumacs.has(numac)) {
      seenNumacs.add(numac)

      documents.push({
        numac,
        title: title || `Document ${numac}`,
        documentType: 'LOI',
        publicationDate: pubDate,
        source: 'Justel',
        url: `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list`,
      })
    }
  }

  // Alternative pattern if numac comes before pd_search
  if (documents.length === 0) {
    const altRegex =
      /<a\s+href="article\.pl\?[^"]*numac_search=([A-Z0-9]+)[^"]*pd_search=(\d{4}-\d{2}-\d{2})[^"]*"[^>]*class="list-item--title"[^>]*>\s*([^<]+)/gi

    while ((match = altRegex.exec(html)) !== null) {
      const numac = match[1]
      const pubDate = match[2]
      const title = cleanHtml(match[3])

      if (numac && !seenNumacs.has(numac)) {
        seenNumacs.add(numac)

        documents.push({
          numac,
          title: title || `Document ${numac}`,
          documentType: 'LOI',
          publicationDate: pubDate,
          source: 'Justel',
          url: `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list`,
        })
      }
    }
  }

  return documents
}

/**
 * Execute search on Moniteur Belge / Justel database
 * Uses the list.pl endpoint with GET request (new 2024 interface)
 */
export async function executeMoniteurBelgeSearch(
  params: MoniteurBelgeSearchParams
): Promise<ToolResult<LegislationSearchResult>> {
  const startTime = Date.now()
  const { query, limit = 15 } = params

  console.log('[MONITEUR-BELGE] Executing search:', { query, limit })

  try {
    // Use GET request to list.pl - the new interface
    const searchUrl = `${BASE_URL}/cgi_loi/list.pl?language=fr&text1=${encodeURIComponent(query)}`
    console.log('[MONITEUR-BELGE] Search URL:', searchUrl)

    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    console.log('[MONITEUR-BELGE] Response size:', html.length, 'bytes')

    // Parse results using the new parser
    let documents = parseNewListResults(html)

    // Fallback to old parser if new one doesn't work
    if (documents.length === 0) {
      documents = parseListResults(html)
    }

    console.log('[MONITEUR-BELGE] Parsed', documents.length, 'documents')

    // Limit results
    documents = documents.slice(0, limit)

    // Fetch additional details for top results (in parallel for speed)
    const enrichmentPromises = documents
      .slice(0, Math.min(5, limit))
      .map(async (doc) => {
        const details = await fetchArticleDetails(doc.numac, doc.documentType)
        return {
          ...doc,
          title: details.title || doc.title,
          summary: details.summary,
        }
      })

    const enrichedDocs = await Promise.all(enrichmentPromises)

    // Add remaining docs without enrichment
    for (const doc of documents.slice(5)) {
      enrichedDocs.push({ ...doc, summary: doc.summary })
    }

    const durationMs = Date.now() - startTime
    console.log(
      `[MONITEUR-BELGE] Search completed: ${enrichedDocs.length} results in ${durationMs}ms`
    )

    if (enrichedDocs.length > 0) {
      console.log('[MONITEUR-BELGE] First results:')
      enrichedDocs.slice(0, 3).forEach((doc, i) => {
        console.log(`  ${i + 1}. ${doc.numac} - ${doc.title.slice(0, 60)}...`)
      })
    }

    return {
      success: true,
      data: {
        query,
        totalCount: documents.length,
        documents: enrichedDocs,
        fetchedAt: new Date().toISOString(),
        source: 'moniteur-belge',
      },
      metadata: {
        durationMs,
        source: 'ejustice.just.fgov.be',
        itemCount: enrichedDocs.length,
      },
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    console.error('[MONITEUR-BELGE] Search failed:', errorMessage)

    return {
      success: false,
      error: errorMessage,
      metadata: {
        durationMs,
        source: 'ejustice.just.fgov.be',
      },
    }
  }
}

/**
 * Decode ISO-8859-1 content to UTF-8
 */
function decodeIso8859(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let result = ''
  for (let i = 0; i < bytes.length; i++) {
    result += String.fromCharCode(bytes[i])
  }
  return result
}

export interface LegislationContent {
  fullText: string
  tableOfContents: string[]
  matchingArticles: string[]
  eliUrl: string
  title: string
}

/**
 * Fetch full legislation content with table of contents and article search
 */
export async function fetchLegislationContent(
  numac: string,
  searchTerm?: string
): Promise<LegislationContent> {
  const emptyResult: LegislationContent = {
    fullText: '',
    tableOfContents: [],
    matchingArticles: [],
    eliUrl: '',
    title: '',
  }

  try {
    console.log(
      `[MONITEUR-BELGE] Fetching legislation content for NUMAC: ${numac}`
    )

    // First get the ELI URL from the article page
    const articleUrl = `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list`
    const articleResponse = await fetch(articleUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
    })

    if (!articleResponse.ok) {
      console.log(
        `[MONITEUR-BELGE] Article page fetch failed: ${articleResponse.status}`
      )
      return emptyResult
    }

    const articleHtml = await articleResponse.text()

    // Extract ELI URL
    const eliMatch = articleHtml.match(
      /href="(https:\/\/www\.ejustice\.just\.fgov\.be\/eli\/[^"]+)"/
    )
    if (!eliMatch) {
      console.log('[MONITEUR-BELGE] No ELI URL found in article page')
      return emptyResult
    }

    const eliUrl = eliMatch[1]
    console.log(`[MONITEUR-BELGE] Found ELI URL: ${eliUrl}`)

    // Fetch the full legislation text from ELI URL
    const eliResponse = await fetch(eliUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
    })

    if (!eliResponse.ok) {
      console.log(
        `[MONITEUR-BELGE] ELI page fetch failed: ${eliResponse.status}`
      )
      return { ...emptyResult, eliUrl }
    }

    // Handle ISO-8859-1 encoding
    const buffer = await eliResponse.arrayBuffer()
    const fullHtml = decodeIso8859(buffer)
    console.log(`[MONITEUR-BELGE] ELI page size: ${fullHtml.length} bytes`)

    // Extract the title
    const titleMatch = fullHtml.match(/<title>([^<]+)<\/title>/i)
    const title = titleMatch ? cleanHtml(titleMatch[1]) : ''

    // Extract table of contents from the TOC section
    const tableOfContents: string[] = []
    const tocSection = fullHtml.match(
      /<h2[^>]*id="toc"[^>]*>[\s\S]*?<\/h2>\s*([\s\S]*?)(?=<h2|<div class="row mt-4"|$)/i
    )
    if (tocSection) {
      // Extract TOC entries - format varies but often contains article references
      const tocEntries = tocSection[1].match(/<a[^>]*>([^<]+)<\/a>/gi) || []
      for (const entry of tocEntries) {
        const text = cleanHtml(entry)
        if (text && text.length > 3) {
          tableOfContents.push(text)
        }
      }
      // Also capture plain text entries that contain Art. references
      const plainEntries =
        tocSection[1].match(
          /(?:Titre|Chapitre|Section|Sous-section|Art\.)[^\n<]+/gi
        ) || []
      for (const entry of plainEntries) {
        const text = cleanHtml(entry)
        if (text && text.length > 3 && !tableOfContents.includes(text)) {
          tableOfContents.push(text)
        }
      }
    }
    console.log(`[MONITEUR-BELGE] Found ${tableOfContents.length} TOC entries`)

    // Extract the text section
    const textSection = fullHtml.match(
      /<h2[^>]*id="text"[^>]*[^>]*>Texte<\/h2>\s*([\s\S]*?)(?:<\/div>\s*<div|<footer|$)/i
    )
    let fullText = ''
    if (textSection) {
      // Clean but preserve structure
      fullText = textSection[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 100000)
    }
    console.log(`[MONITEUR-BELGE] Extracted text: ${fullText.length} chars`)

    // Search for matching articles
    const matchingArticles: string[] = []
    if (searchTerm && fullText) {
      const searchTermLower = searchTerm.toLowerCase()
      console.log(`[MONITEUR-BELGE] Searching for term: "${searchTerm}"`)

      // First, check if term exists in full text
      if (fullText.toLowerCase().includes(searchTermLower)) {
        console.log(`[MONITEUR-BELGE] Term "${searchTerm}" found in full text`)
      } else {
        console.log(
          `[MONITEUR-BELGE] Term "${searchTerm}" NOT found in full text`
        )
        // Check TOC for related sections
        for (const tocEntry of tableOfContents) {
          if (tocEntry.toLowerCase().includes(searchTermLower)) {
            matchingArticles.push(`[TABLE DES MATIÈRES] ${tocEntry}`)
          }
        }
      }

      // Split by "Art. X.XXX" pattern to find individual articles
      // Pattern handles various article formats: Art. 5.207, Art. 1154, etc.
      const articlePattern =
        /Art(?:icle)?\.?\s*(\d+(?:\.\d+)?[A-Za-z]*)[.\s\-–]*([^]*?)(?=Art(?:icle)?\.?\s*\d+|CHAPITRE|TITRE|SECTION|$)/gi
      let match
      let articleCount = 0
      while (
        (match = articlePattern.exec(fullText)) !== null &&
        articleCount < 500
      ) {
        articleCount++
        const articleNum = match[1]
        const articleContent = match[2].trim()

        if (articleContent.toLowerCase().includes(searchTermLower)) {
          const preview = articleContent.slice(0, 600).replace(/\s+/g, ' ')
          matchingArticles.push(`Article ${articleNum}: ${preview}...`)
          console.log(`[MONITEUR-BELGE] Found matching Article ${articleNum}`)
        }
      }
      console.log(
        `[MONITEUR-BELGE] Scanned ${articleCount} articles, found ${matchingArticles.length} matches`
      )
    }

    // If no matches but search term relates to common legal concepts, try synonyms
    if (searchTerm && matchingArticles.length === 0) {
      const synonymMap: Record<string, string[]> = {
        anatocisme: [
          'intérêts',
          'capitalisation',
          'intérêts échus',
          'intérêts moratoires',
          'intérêts rémunératoires',
        ],
        prescription: ['délai', 'prescription', 'péremption'],
        bail: ['loyer', 'location', 'locataire', 'bailleur'],
      }

      const searchLower = searchTerm.toLowerCase()
      const synonyms = synonymMap[searchLower] || []

      if (synonyms.length > 0) {
        console.log(
          `[MONITEUR-BELGE] Trying synonyms for "${searchTerm}": ${synonyms.join(', ')}`
        )

        const articlePattern =
          /Art(?:icle)?\.?\s*(\d+(?:\.\d+)?[A-Za-z]*)[.\s\-–]*([^]*?)(?=Art(?:icle)?\.?\s*\d+|CHAPITRE|TITRE|SECTION|$)/gi
        let match
        while ((match = articlePattern.exec(fullText)) !== null) {
          const articleNum = match[1]
          const articleContent = match[2].trim().toLowerCase()

          // Check if article contains multiple synonyms (more likely to be relevant)
          const matchedSynonyms = synonyms.filter((syn) =>
            articleContent.includes(syn.toLowerCase())
          )
          if (matchedSynonyms.length >= 2) {
            const preview = match[2].trim().slice(0, 600).replace(/\s+/g, ' ')
            matchingArticles.push(
              `Article ${articleNum} [contient: ${matchedSynonyms.join(', ')}]: ${preview}...`
            )
            console.log(
              `[MONITEUR-BELGE] Found related Article ${articleNum} via synonyms`
            )
          }
        }
      }
    }

    return { fullText, tableOfContents, matchingArticles, eliUrl, title }
  } catch (error) {
    console.error('[MONITEUR-BELGE] Error fetching legislation content:', error)
    return emptyResult
  }
}

/**
 * Get article content by NUMAC
 */
export async function getArticleByNumac(
  numac: string
): Promise<ToolResult<{ numac: string; content: string; url: string }>> {
  const startTime = Date.now()

  try {
    const url = `${BASE_URL}/cgi_loi/article.pl?language=fr&numac_search=${numac}&lg_txt=F&caller=list`

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Extract main text content
    const textMatch = html.match(
      /<h2[^>]*id="text"[^>]*>[\s\S]*?<\/h2>([\s\S]*?)(?:<h2|<footer)/i
    )
    const content = textMatch ? cleanHtml(textMatch[1]).slice(0, 5000) : ''

    return {
      success: true,
      data: { numac, content, url },
      metadata: {
        durationMs: Date.now() - startTime,
        source: 'ejustice.just.fgov.be',
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        durationMs: Date.now() - startTime,
        source: 'ejustice.just.fgov.be',
      },
    }
  }
}
