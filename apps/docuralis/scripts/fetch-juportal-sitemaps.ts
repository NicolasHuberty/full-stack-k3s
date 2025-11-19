#!/usr/bin/env bun

import { prisma } from '../src/lib/prisma'
import { createCollection } from '../src/lib/collections/service'
import { promises as fs } from 'fs'
import path from 'path'

interface ECLIDocument {
  ecli: string
  urls: {
    de?: string
    fr?: string
    nl?: string
  }
  court: string
  date: string
  creator: {
    de?: string
    fr?: string
    nl?: string
  }
  coverage: string
  languages: string[]
  type: string
  subject: {
    de?: string
    fr?: string
    nl?: string
  }
  abstract: {
    de?: string
    fr?: string
    nl?: string
  }
  description: {
    de?: string
    fr?: string
    nl?: string
  }
  issued: string
  references: string[]
}

async function fetchSitemapIndex(url: string): Promise<string[]> {
  console.log(`Fetching sitemap index: ${url}`)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xml = await response.text()

    // Parse sitemap URLs from XML
    const sitemapUrls: string[] = []
    const sitemapMatches = xml.match(/<loc>(.*?)<\/loc>/g)

    if (sitemapMatches) {
      for (const match of sitemapMatches) {
        const url = match.replace(/<\/?loc>/g, '')
        sitemapUrls.push(url)
      }
    }

    console.log(`Found ${sitemapUrls.length} sitemaps`)
    return sitemapUrls
  } catch (error) {
    console.error(`Error fetching sitemap index ${url}:`, error)
    return []
  }
}

async function fetchSitemap(url: string): Promise<ECLIDocument[]> {
  console.log(`Fetching sitemap: ${url}`)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xml = await response.text()
    const documents: ECLIDocument[] = []

    // Parse ECLI documents from XML
    const urlMatches = xml.match(/<url>([\s\S]*?)<\/url>/g)

    if (urlMatches) {
      for (const urlMatch of urlMatches) {
        try {
          const doc = parseECLIDocument(urlMatch)
          if (doc) {
            documents.push(doc)
          }
        } catch (error) {
          console.error('Error parsing document:', error)
        }
      }
    }

    console.log(`  Parsed ${documents.length} documents`)
    return documents
  } catch (error) {
    console.error(`Error fetching sitemap ${url}:`, error)
    return []
  }
}

function parseECLIDocument(urlXml: string): ECLIDocument | null {
  try {
    // Extract ECLI identifier
    const ecliMatch = urlXml.match(/<ecli:isVersionOf value="(ECLI:[^"]+)"/)
    if (!ecliMatch) return null

    const ecli = ecliMatch[1]

    // Extract URLs by language
    const urls: { de?: string; fr?: string; nl?: string } = {}
    const urlMatches = urlXml.match(/<ecli:identifier lang="([^"]+)" format="text\/html"[^>]*>([^<]+)</g)
    if (urlMatches) {
      for (const match of urlMatches) {
        const langMatch = match.match(/lang="([^"]+)"/)
        const urlMatch = match.match(/>([^<]+)</)
        if (langMatch && urlMatch) {
          urls[langMatch[1] as keyof typeof urls] = urlMatch[1]
        }
      }
    }

    // Extract court
    const courtMatch = urlXml.match(/<ecli:court>([^<]+)/)
    const court = courtMatch ? courtMatch[1] : ''

    // Extract date
    const dateMatch = urlXml.match(/<ecli:date>([^<]+)/)
    const date = dateMatch ? dateMatch[1] : ''

    // Extract creator by language
    const creator: { de?: string; fr?: string; nl?: string } = {}
    const creatorMatches = urlXml.match(/<ecli:creator lang="([^"]+)">([^<]+)/g)
    if (creatorMatches) {
      for (const match of creatorMatches) {
        const langMatch = match.match(/lang="([^"]+)"/)
        const valueMatch = match.match(/>([^<]+)$/)
        if (langMatch && valueMatch) {
          creator[langMatch[1] as keyof typeof creator] = valueMatch[1]
        }
      }
    }

    // Extract coverage
    const coverageMatch = urlXml.match(/<ecli:coverage[^>]*>([^<]+)/)
    const coverage = coverageMatch ? coverageMatch[1] : ''

    // Extract languages
    const languages: string[] = []
    const languageMatches = urlXml.match(/<ecli:language languageType="authoritative">([^<]+)/g)
    if (languageMatches) {
      for (const match of languageMatches) {
        const langMatch = match.match(/>([^<]+)$/)
        if (langMatch) {
          languages.push(langMatch[1])
        }
      }
    }

    // Extract type
    const typeMatch = urlXml.match(/<ecli:type[^>]*>([^<]+)/)
    const type = typeMatch ? typeMatch[1] : ''

    // Extract subject by language
    const subject: { de?: string; fr?: string; nl?: string } = {}
    const subjectMatches = urlXml.match(/<ecli:subject lang="([^"]+)">([^<]+)/g)
    if (subjectMatches) {
      for (const match of subjectMatches) {
        const langMatch = match.match(/lang="([^"]+)"/)
        const valueMatch = match.match(/>([^<]+)$/)
        if (langMatch && valueMatch) {
          subject[langMatch[1] as keyof typeof subject] = valueMatch[1]
        }
      }
    }

    // Extract abstract by language
    const abstract: { de?: string; fr?: string; nl?: string } = {}
    const abstractMatches = urlXml.match(/<ecli:abstract lang="([^"]+)">([^<]+)/g)
    if (abstractMatches) {
      for (const match of abstractMatches) {
        const langMatch = match.match(/lang="([^"]+)"/)
        const valueMatch = match.match(/>([^<]+)$/)
        if (langMatch && valueMatch) {
          abstract[langMatch[1] as keyof typeof abstract] = valueMatch[1]
        }
      }
    }

    // Extract description by language
    const description: { de?: string; fr?: string; nl?: string } = {}
    const descriptionMatches = urlXml.match(/<ecli:description lang="([^"]+)">([^<]+)/g)
    if (descriptionMatches) {
      for (const match of descriptionMatches) {
        const langMatch = match.match(/lang="([^"]+)"/)
        const valueMatch = match.match(/>([^<]+)$/)
        if (langMatch && valueMatch) {
          description[langMatch[1] as keyof typeof description] = valueMatch[1]
        }
      }
    }

    // Extract issued date
    const issuedMatch = urlXml.match(/<ecli:issued>([^<]+)/)
    const issued = issuedMatch ? issuedMatch[1] : ''

    // Extract references
    const references: string[] = []
    const referenceMatches = urlXml.match(/<ecli:reference[^>]*>([^<]+)/g)
    if (referenceMatches) {
      for (const match of referenceMatches) {
        const valueMatch = match.match(/>([^<]+)$/)
        if (valueMatch) {
          references.push(valueMatch[1])
        }
      }
    }

    return {
      ecli,
      urls,
      court,
      date,
      creator,
      coverage,
      languages,
      type,
      subject,
      abstract,
      description,
      issued,
      references
    }
  } catch (error) {
    console.error('Error parsing ECLI document XML:', error)
    return null
  }
}

async function getAllSitemapUrls(): Promise<string[]> {
  console.log('Fetching all sitemap URLs from robots.txt...')

  try {
    const robotsResponse = await fetch('https://juportal.be/robots.txt')
    if (!robotsResponse.ok) {
      throw new Error(`Failed to fetch robots.txt: ${robotsResponse.status}`)
    }

    const robotsTxt = await robotsResponse.text()
    const sitemapUrls: string[] = []

    // Extract sitemap URLs
    const lines = robotsTxt.split('\n')
    for (const line of lines) {
      if (line.startsWith('Sitemap:')) {
        const url = line.replace('Sitemap:', '').trim()
        sitemapUrls.push(url)
      }
    }

    console.log(`Found ${sitemapUrls.length} sitemap index URLs`)
    return sitemapUrls
  } catch (error) {
    console.error('Error fetching sitemap URLs:', error)
    return []
  }
}

async function fetchAllJUPORTALDocuments(maxSitemaps = 5, maxDocuments = 1000) {
  console.log('Starting JUPORTAL sitemap fetch...\n')

  // Get user
  const user = await prisma.user.findFirst()
  if (!user) {
    throw new Error('No users found in database. Please create a user first.')
  }

  console.log(`Using user: ${user.email} (${user.id})\n`)

  // Find or create collection
  let collection = await prisma.collection.findFirst({
    where: {
      name: 'JUPORTAL Complete Database',
      ownerId: user.id
    }
  })

  if (!collection) {
    console.log('Creating JUPORTAL Complete Database collection...')
    collection = await createCollection({
      name: 'JUPORTAL Complete Database',
      description: 'Complete Belgian jurisprudence from JUPORTAL sitemaps',
      visibility: 'PRIVATE',
      ownerId: user.id,
      embeddingModel: 'text-embedding-3-small',
      chunkSize: 1000,
      chunkOverlap: 200
    })
  }

  console.log(`Using collection: ${collection.name} (${collection.id})\n`)

  // Get all sitemap index URLs
  const sitemapIndexUrls = await getAllSitemapUrls()

  if (sitemapIndexUrls.length === 0) {
    throw new Error('No sitemap URLs found')
  }

  console.log(`Processing first ${maxSitemaps} sitemap indexes...\n`)

  let totalDocuments = 0
  let importedCount = 0
  let skippedCount = 0

  // Process sitemap indexes (limit to avoid overwhelming)
  for (let i = 0; i < Math.min(maxSitemaps, sitemapIndexUrls.length); i++) {
    const indexUrl = sitemapIndexUrls[i]
    console.log(`\n=== Processing sitemap index ${i + 1}/${Math.min(maxSitemaps, sitemapIndexUrls.length)} ===`)

    // Get individual sitemap URLs from this index
    const sitemapUrls = await fetchSitemapIndex(indexUrl)

    // Process each sitemap
    for (const sitemapUrl of sitemapUrls) {
      if (totalDocuments >= maxDocuments) {
        console.log(`\nReached maximum document limit (${maxDocuments})`)
        break
      }

      const documents = await fetchSitemap(sitemapUrl)
      totalDocuments += documents.length

      // Import documents to database
      for (const doc of documents) {
        if (importedCount + skippedCount >= maxDocuments) break

        try {
          const filename = `${doc.ecli}.html`

          // Check if document already exists
          const existingDoc = await prisma.document.findFirst({
            where: {
              collectionId: collection.id,
              filename: filename
            }
          })

          if (!existingDoc) {
            const frenchUrl = doc.urls.fr || doc.urls.nl || doc.urls.de || ''
            const abstract = doc.abstract.fr || doc.abstract.nl || doc.abstract.de || ''
            const description = doc.description.fr || doc.description.nl || doc.description.de || ''
            const subject = doc.subject.fr || doc.subject.nl || doc.subject.de || ''

            const metadata = {
              source: 'JUPORTAL_SITEMAP',
              ecli: doc.ecli,
              court: doc.court,
              date: doc.date,
              issued: doc.issued,
              coverage: doc.coverage,
              languages: doc.languages,
              type: doc.type,
              subject,
              abstract,
              description,
              references: doc.references,
              urls: doc.urls
            }

            const document = await prisma.document.create({
              data: {
                filename: filename,
                originalName: filename,
                mimeType: 'text/html',
                fileSize: BigInt(abstract.length + description.length + subject.length),
                fileUrl: frenchUrl,
                collectionId: collection.id,
                uploadedById: user.id,
                title: doc.ecli,
                status: 'PENDING',
                extractedText: `${abstract}\n\n${description}\n\nSubject: ${subject}`,
                language: doc.languages[0] || 'fr'
              }
            })

            importedCount++
            if (importedCount % 100 === 0) {
              console.log(`  Imported ${importedCount} documents...`)
            }
          } else {
            skippedCount++
          }
        } catch (error) {
          console.error(`Error importing ${doc.ecli}:`, error)
        }
      }

      // Rate limiting - wait between sitemaps
      await new Promise(resolve => setTimeout(resolve, 1000))

      if (totalDocuments >= maxDocuments) break
    }

    if (totalDocuments >= maxDocuments) break
  }

  console.log(`\n✅ Processing completed!`)
  console.log(`Total documents found: ${totalDocuments}`)
  console.log(`Imported: ${importedCount}`)
  console.log(`Skipped (already exists): ${skippedCount}`)
  console.log(`Collection: ${collection.name} (${collection.id})`)
}

// Execute if run directly
if (require.main === module) {
  const maxSitemaps = parseInt(process.argv[2]) || 5
  const maxDocuments = parseInt(process.argv[3]) || 1000

  console.log(`Configuration:`)
  console.log(`- Max sitemap indexes: ${maxSitemaps}`)
  console.log(`- Max documents: ${maxDocuments}`)
  console.log(`- Use: bun run scripts/fetch-juportal-sitemaps.ts [maxSitemaps] [maxDocuments]\n`)

  fetchAllJUPORTALDocuments(maxSitemaps, maxDocuments)
    .then(() => {
      console.log('\nDone!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { fetchAllJUPORTALDocuments, getAllSitemapUrls, fetchSitemap, fetchSitemapIndex }