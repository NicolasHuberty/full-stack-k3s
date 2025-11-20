#!/usr/bin/env bun

/**
 * EXACT count of ALL JUPORTAL documents
 *
 * This script will:
 * 1. Fetch all 14,467 sitemap index URLs from robots.txt
 * 2. For each sitemap index, count the number of individual sitemaps
 * 3. For each individual sitemap, count the number of documents
 * 4. Print running total and progress
 * 5. Give exact final count
 *
 * Usage: bun run scripts/count-all-juportal-exact.ts [startIndex] [maxIndexes]
 *
 * Examples:
 *   bun run scripts/count-all-juportal-exact.ts          # Count all 14,467 indexes
 *   bun run scripts/count-all-juportal-exact.ts 0 100    # Count first 100 indexes
 *   bun run scripts/count-all-juportal-exact.ts 5000     # Start from index 5000
 */

import { promises as fs } from 'fs'

interface CountProgress {
  totalIndexes: number
  processedIndexes: number
  totalSitemaps: number
  totalDocuments: number
  startTime: string
  lastUpdate: string
  currentIndex: number
  errors: number
  avgDocsPerIndex: number
  estimatedRemaining: number
  etaMinutes: number
}

const PROGRESS_FILE = 'juportal-exact-count.json'

async function saveProgress(progress: CountProgress) {
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

async function loadProgress(): Promise<CountProgress | null> {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

async function getAllSitemapIndexUrls(): Promise<string[]> {
  console.log('🔍 Fetching all sitemap index URLs from robots.txt...')

  try {
    const response = await fetch('https://juportal.be/robots.txt')
    if (!response.ok) {
      throw new Error(`Failed to fetch robots.txt: ${response.status}`)
    }

    const robotsTxt = await response.text()
    const sitemapUrls: string[] = []

    const lines = robotsTxt.split('\n')
    for (const line of lines) {
      if (line.startsWith('Sitemap:')) {
        const url = line.replace('Sitemap:', '').trim()
        sitemapUrls.push(url)
      }
    }

    console.log(`📋 Found ${sitemapUrls.length} sitemap index URLs`)
    return sitemapUrls
  } catch (error) {
    console.error('❌ Error fetching sitemap URLs:', error)
    throw error
  }
}

async function countSitemapsInIndex(indexUrl: string): Promise<number> {
  try {
    const response = await fetch(indexUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const xml = await response.text()
    const sitemapMatches = xml.match(/<loc>(.*?)<\/loc>/g)
    return sitemapMatches ? sitemapMatches.length : 0
  } catch (error) {
    console.error(`❌ Error fetching index ${indexUrl}:`, error)
    return 0
  }
}

async function countDocumentsInSitemap(sitemapUrl: string): Promise<number> {
  try {
    const response = await fetch(sitemapUrl)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const xml = await response.text()
    const urlMatches = xml.match(/<url>/g)
    return urlMatches ? urlMatches.length : 0
  } catch (error) {
    console.error(`❌ Error fetching sitemap ${sitemapUrl}:`, error)
    return 0
  }
}

async function countAllDocumentsExact(
  startIndex = 0,
  maxIndexes = Infinity,
  delayMs = 100
) {
  console.log('🚀 Starting EXACT count of ALL JUPORTAL documents...')
  console.log(
    `📊 Parameters: startIndex=${startIndex}, maxIndexes=${maxIndexes}, delay=${delayMs}ms\n`
  )

  // Load or create progress
  let progress = await loadProgress()
  const isResuming = !!progress

  if (isResuming) {
    console.log('📂 Resuming from previous session...')
    startIndex = Math.max(startIndex, progress.currentIndex)
  }

  // Get all sitemap index URLs
  const allIndexUrls = await getAllSitemapIndexUrls()
  const indexUrls = allIndexUrls.slice(
    startIndex,
    Math.min(startIndex + maxIndexes, allIndexUrls.length)
  )

  if (!progress) {
    progress = {
      totalIndexes: indexUrls.length,
      processedIndexes: 0,
      totalSitemaps: 0,
      totalDocuments: 0,
      startTime: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
      currentIndex: startIndex,
      errors: 0,
      avgDocsPerIndex: 0,
      estimatedRemaining: 0,
      etaMinutes: 0,
    }
  }

  console.log(
    `🎯 Processing ${indexUrls.length} sitemap indexes (${startIndex} to ${startIndex + indexUrls.length - 1})`
  )
  console.log(
    `📅 Date range: ${allIndexUrls[0]} to ${allIndexUrls[allIndexUrls.length - 1]}`
  )
  console.log()

  const startTime = new Date()

  // Process each sitemap index
  for (let i = 0; i < indexUrls.length; i++) {
    const indexUrl = indexUrls[i]
    const globalIndex = startIndex + i
    progress.currentIndex = globalIndex

    try {
      console.log(
        `📋 [${globalIndex + 1}/${allIndexUrls.length}] Processing: ${indexUrl}`
      )

      // Count sitemaps in this index
      const sitemapCount = await countSitemapsInIndex(indexUrl)
      progress.totalSitemaps += sitemapCount

      console.log(`   📄 Found ${sitemapCount} sitemaps in index`)

      // Get individual sitemap URLs
      const response = await fetch(indexUrl)
      const xml = await response.text()
      const sitemapMatches = xml.match(/<loc>(.*?)<\/loc>/g)

      let indexDocuments = 0
      if (sitemapMatches) {
        for (const match of sitemapMatches) {
          const sitemapUrl = match.replace(/<\/?loc>/g, '')
          const docCount = await countDocumentsInSitemap(sitemapUrl)
          indexDocuments += docCount

          // Small delay between sitemap requests
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs))
          }
        }
      }

      progress.totalDocuments += indexDocuments
      progress.processedIndexes++

      // Calculate statistics
      progress.avgDocsPerIndex =
        progress.totalDocuments / progress.processedIndexes
      progress.estimatedRemaining =
        progress.avgDocsPerIndex *
        (progress.totalIndexes - progress.processedIndexes)

      const elapsedMs = new Date().getTime() - startTime.getTime()
      const avgTimePerIndex = elapsedMs / progress.processedIndexes
      progress.etaMinutes =
        (avgTimePerIndex *
          (progress.totalIndexes - progress.processedIndexes)) /
        1000 /
        60

      // Progress line
      const progressPercent = (
        (progress.processedIndexes / progress.totalIndexes) *
        100
      ).toFixed(1)
      console.log(`   ✅ Index documents: ${indexDocuments}`)
      console.log(
        `   📊 RUNNING TOTAL: ${progress.totalDocuments.toLocaleString()} documents`
      )
      console.log(
        `   🚀 Progress: ${progress.processedIndexes}/${progress.totalIndexes} (${progressPercent}%) - ETA: ${progress.etaMinutes.toFixed(1)} min`
      )
      console.log(
        `   📈 Avg per index: ${progress.avgDocsPerIndex.toFixed(1)} - Estimated final: ${(progress.totalDocuments + progress.estimatedRemaining).toLocaleString()}`
      )
      console.log()

      // Save progress every 10 indexes
      if (progress.processedIndexes % 10 === 0) {
        progress.lastUpdate = new Date().toISOString()
        await saveProgress(progress)
        console.log(
          `💾 Progress saved (${progress.processedIndexes}/${progress.totalIndexes})\n`
        )
      }
    } catch (error) {
      progress.errors++
      console.error(`❌ Error processing index ${globalIndex + 1}: ${error}`)
      console.log()
    }

    // Rate limiting between indexes
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  // Final results
  const totalElapsed = (new Date().getTime() - startTime.getTime()) / 1000 / 60

  console.log('🎉 EXACT COUNT COMPLETED!')
  console.log('================================')
  console.log(`📊 FINAL RESULTS:`)
  console.log(
    `   • Total sitemap indexes processed: ${progress.processedIndexes}`
  )
  console.log(`   • Total individual sitemaps: ${progress.totalSitemaps}`)
  console.log(
    `   • EXACT DOCUMENT COUNT: ${progress.totalDocuments.toLocaleString()}`
  )
  console.log(`   • Errors encountered: ${progress.errors}`)
  console.log(`   • Time elapsed: ${totalElapsed.toFixed(1)} minutes`)
  console.log(
    `   • Average documents per index: ${progress.avgDocsPerIndex.toFixed(1)}`
  )
  console.log(
    `   • Average processing rate: ${(progress.processedIndexes / totalElapsed).toFixed(1)} indexes/min`
  )
  console.log()

  if (startIndex + indexUrls.length < allIndexUrls.length) {
    const remaining = allIndexUrls.length - (startIndex + indexUrls.length)
    console.log(
      `⚠️  Note: Only processed ${indexUrls.length} of ${allIndexUrls.length} total indexes`
    )
    console.log(
      `   To continue: bun run scripts/count-all-juportal-exact.ts ${startIndex + indexUrls.length}`
    )
    console.log(`   Remaining: ${remaining} indexes`)
  } else {
    console.log(`✅ ALL ${allIndexUrls.length} sitemap indexes processed!`)

    // Extrapolate if we sampled
    if (progress.processedIndexes < allIndexUrls.length) {
      const extrapolated = progress.avgDocsPerIndex * allIndexUrls.length
      console.log(
        `🔮 EXTRAPOLATED TOTAL (all ${allIndexUrls.length} indexes): ${extrapolated.toLocaleString()} documents`
      )
    }
  }

  // Clean up progress file if completed successfully
  if (
    startIndex + indexUrls.length >= allIndexUrls.length &&
    progress.errors === 0
  ) {
    try {
      await fs.unlink(PROGRESS_FILE)
      console.log('🧹 Cleaned up progress file')
    } catch {}
  }

  return progress
}

// Execute if run directly
if (require.main === module) {
  const startIndex = parseInt(process.argv[2]) || 0
  const maxIndexes = parseInt(process.argv[3]) || Infinity
  const delayMs = parseInt(process.argv[4]) || 100

  console.log('🔧 Configuration:')
  console.log(`   • Start index: ${startIndex}`)
  console.log(
    `   • Max indexes: ${maxIndexes === Infinity ? 'All remaining' : maxIndexes}`
  )
  console.log(`   • Delay between requests: ${delayMs}ms`)
  console.log(`   • Progress file: ${PROGRESS_FILE}`)
  console.log()

  countAllDocumentsExact(startIndex, maxIndexes, delayMs)
    .then((result) => {
      console.log('\n🏁 Script completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error)
      process.exit(1)
    })
}

export { countAllDocumentsExact }
