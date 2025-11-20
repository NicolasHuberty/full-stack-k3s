#!/usr/bin/env bun

/**
 * Production script to fetch ALL JUPORTAL documents (200,000+)
 *
 * This script is designed for large-scale data import with:
 * - Rate limiting to be respectful to JUPORTAL servers
 * - Batch processing to avoid memory issues
 * - Resume capability if interrupted
 * - Progress tracking and logging
 *
 * Usage:
 *   bun run scripts/fetch-all-juportal.ts [startIndex] [batchSize] [delayMs]
 *
 * Example:
 *   bun run scripts/fetch-all-juportal.ts 0 100 2000
 *   - Start from index 0
 *   - Process 100 documents per batch
 *   - Wait 2000ms between batches
 */

import {
  fetchAllJUPORTALDocuments,
  getAllSitemapUrls,
  fetchSitemapIndex,
  fetchSitemap,
} from './fetch-juportal-sitemaps'
import { prisma } from '../src/lib/prisma'
import { createCollection } from '../src/lib/collections/service'
import { promises as fs } from 'fs'
import path from 'path'

interface ProgressState {
  totalSitemaps: number
  processedSitemaps: number
  totalDocuments: number
  importedDocuments: number
  skippedDocuments: number
  startTime: string
  lastUpdate: string
  currentSitemapIndex: number
  errors: Array<{
    sitemap?: string
    ecli?: string
    error: string
    timestamp: string
  }>
}

const PROGRESS_FILE = 'juportal-progress.json'
const LOG_FILE = 'juportal-import.log'

async function saveProgress(state: ProgressState) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(state, null, 2))
}

async function loadProgress(): Promise<ProgressState | null> {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

function log(message: string) {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] ${message}\n`
  console.log(message)
  fs.appendFile(LOG_FILE, logMessage).catch(console.error)
}

async function fetchAllJUPORTALProduction(
  startIndex = 0,
  batchSize = 1000,
  delayMs = 2000,
  maxSitemaps = Infinity
) {
  log('🚀 Starting JUPORTAL production import...')

  // Load or create progress state
  let progress = await loadProgress()
  if (progress) {
    log(
      `📊 Resuming from previous session: ${progress.processedSitemaps}/${progress.totalSitemaps} sitemaps processed`
    )
    startIndex = Math.max(startIndex, progress.currentSitemapIndex)
  } else {
    progress = {
      totalSitemaps: 0,
      processedSitemaps: 0,
      totalDocuments: 0,
      importedDocuments: 0,
      skippedDocuments: 0,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      currentSitemapIndex: startIndex,
      errors: [],
    }
  }

  // Get user
  const user = await prisma.user.findFirst()
  if (!user) {
    throw new Error('No users found in database. Please create a user first.')
  }
  log(`👤 Using user: ${user.email}`)

  // Find or create collection
  let collection = await prisma.collection.findFirst({
    where: {
      name: 'JUPORTAL Complete Database',
      ownerId: user.id,
    },
  })

  if (!collection) {
    log('📚 Creating JUPORTAL Complete Database collection...')
    collection = await createCollection({
      name: 'JUPORTAL Complete Database',
      description:
        'Complete Belgian jurisprudence from JUPORTAL sitemaps (~200,000 documents)',
      visibility: 'PRIVATE',
      ownerId: user.id,
      embeddingModel: 'text-embedding-3-small',
      chunkSize: 1000,
      chunkOverlap: 200,
    })
  }

  log(`📁 Using collection: ${collection.name} (${collection.id})`)

  // Get all sitemap URLs
  log('🗺️  Fetching sitemap URLs...')
  const sitemapIndexUrls = await getAllSitemapUrls()
  progress.totalSitemaps = Math.min(sitemapIndexUrls.length, maxSitemaps)
  log(
    `📊 Found ${sitemapIndexUrls.length} sitemap indexes (processing ${progress.totalSitemaps})`
  )

  // Process sitemaps starting from the specified index
  const endIndex = Math.min(
    startIndex + progress.totalSitemaps,
    sitemapIndexUrls.length
  )

  for (let i = startIndex; i < endIndex; i++) {
    const indexUrl = sitemapIndexUrls[i]
    progress.currentSitemapIndex = i

    log(
      `\n📋 Processing sitemap index ${i + 1}/${progress.totalSitemaps}: ${indexUrl}`
    )

    try {
      // Get individual sitemap URLs from this index
      const sitemapUrls = await fetchSitemapIndex(indexUrl)
      log(`   Found ${sitemapUrls.length} sitemaps in index`)

      // Process each sitemap
      for (const sitemapUrl of sitemapUrls) {
        try {
          const documents = await fetchSitemap(sitemapUrl)
          progress.totalDocuments += documents.length

          log(
            `   📄 Processing ${documents.length} documents from ${sitemapUrl}`
          )

          // Import documents in batches
          for (let j = 0; j < documents.length; j += batchSize) {
            const batch = documents.slice(j, j + batchSize)

            for (const doc of batch) {
              try {
                const filename = `${doc.ecli}.html`

                // Check if document already exists
                const existingDoc = await prisma.document.findFirst({
                  where: {
                    collectionId: collection.id,
                    filename: filename,
                  },
                })

                if (!existingDoc) {
                  const frenchUrl =
                    doc.urls.fr || doc.urls.nl || doc.urls.de || ''
                  const abstract =
                    doc.abstract.fr || doc.abstract.nl || doc.abstract.de || ''
                  const description =
                    doc.description.fr ||
                    doc.description.nl ||
                    doc.description.de ||
                    ''
                  const subject =
                    doc.subject.fr || doc.subject.nl || doc.subject.de || ''

                  await prisma.document.create({
                    data: {
                      filename: filename,
                      originalName: filename,
                      mimeType: 'text/html',
                      fileSize: BigInt(
                        abstract.length + description.length + subject.length
                      ),
                      fileUrl: frenchUrl,
                      collectionId: collection.id,
                      uploadedById: user.id,
                      title: doc.ecli,
                      status: 'PENDING',
                      extractedText: `${abstract}\n\n${description}\n\nSubject: ${subject}`,
                      language: doc.languages[0] || 'fr',
                    },
                  })

                  progress.importedDocuments++
                } else {
                  progress.skippedDocuments++
                }

                // Log progress every 100 documents
                if (
                  (progress.importedDocuments + progress.skippedDocuments) %
                    100 ===
                  0
                ) {
                  const total =
                    progress.importedDocuments + progress.skippedDocuments
                  const rate =
                    total /
                    ((Date.now() - new Date(progress.startTime).getTime()) /
                      1000 /
                      60)
                  log(
                    `     ⚡ Progress: ${total} documents (${rate.toFixed(1)}/min), ${progress.importedDocuments} imported, ${progress.skippedDocuments} skipped`
                  )
                }
              } catch (error) {
                progress.errors.push({
                  ecli: doc.ecli,
                  error:
                    error instanceof Error ? error.message : 'Unknown error',
                  timestamp: new Date().toISOString(),
                })
                log(`     ❌ Error importing ${doc.ecli}: ${error}`)
              }
            }

            // Save progress after each batch
            progress.lastUpdate = new Date().toISOString()
            await saveProgress(progress)

            // Rate limiting between batches
            if (delayMs > 0) {
              await new Promise((resolve) => setTimeout(resolve, delayMs))
            }
          }
        } catch (error) {
          progress.errors.push({
            sitemap: sitemapUrl,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          })
          log(`   ❌ Error processing sitemap ${sitemapUrl}: ${error}`)
        }
      }

      progress.processedSitemaps++
      await saveProgress(progress)

      // Rate limiting between sitemap indexes
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * 2))
      }
    } catch (error) {
      progress.errors.push({
        sitemap: indexUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      })
      log(`❌ Error processing sitemap index ${indexUrl}: ${error}`)
    }

    // Log overall progress
    const elapsed =
      (Date.now() - new Date(progress.startTime).getTime()) / 1000 / 60
    const eta =
      (progress.totalSitemaps - progress.processedSitemaps) /
      (progress.processedSitemaps / elapsed)
    log(
      `📊 Overall: ${progress.processedSitemaps}/${progress.totalSitemaps} sitemaps, ${progress.totalDocuments} docs found, ${progress.importedDocuments} imported, ETA: ${eta.toFixed(1)} min`
    )
  }

  // Final report
  log('\n🎉 Import completed!')
  log(`📊 Final statistics:`)
  log(`   - Sitemap indexes processed: ${progress.processedSitemaps}`)
  log(`   - Total documents found: ${progress.totalDocuments}`)
  log(`   - Documents imported: ${progress.importedDocuments}`)
  log(`   - Documents skipped: ${progress.skippedDocuments}`)
  log(`   - Errors: ${progress.errors.length}`)
  log(`   - Collection: ${collection.name} (${collection.id})`)

  if (progress.errors.length > 0) {
    log(
      `⚠️  ${progress.errors.length} errors occurred. Check ${LOG_FILE} for details.`
    )
  }

  return progress
}

// Execute if run directly
if (require.main === module) {
  const startIndex = parseInt(process.argv[2]) || 0
  const batchSize = parseInt(process.argv[3]) || 1000
  const delayMs = parseInt(process.argv[4]) || 2000
  const maxSitemaps = parseInt(process.argv[5]) || Infinity

  console.log(`🔧 Configuration:`)
  console.log(`   - Start index: ${startIndex}`)
  console.log(`   - Batch size: ${batchSize}`)
  console.log(`   - Delay between batches: ${delayMs}ms`)
  console.log(
    `   - Max sitemaps: ${maxSitemaps === Infinity ? 'All' : maxSitemaps}`
  )
  console.log(`   - Progress file: ${PROGRESS_FILE}`)
  console.log(`   - Log file: ${LOG_FILE}`)
  console.log()

  fetchAllJUPORTALProduction(startIndex, batchSize, delayMs, maxSitemaps)
    .then((progress) => {
      console.log('\n✅ Script completed successfully!')
      if (progress.errors.length === 0) {
        // Clean up progress file if successful
        fs.unlink(PROGRESS_FILE).catch(() => {})
      }
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error)
      process.exit(1)
    })
}
