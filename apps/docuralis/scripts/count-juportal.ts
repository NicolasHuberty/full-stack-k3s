#!/usr/bin/env bun

/**
 * Count total JUPORTAL documents available
 */

import {
  getAllSitemapUrls,
  fetchSitemapIndex,
  fetchSitemap,
} from './fetch-juportal-sitemaps'

async function countJUPORTALDocuments() {
  console.log('🔍 Counting JUPORTAL documents...\n')

  // Get all sitemap URLs
  const sitemapIndexUrls = await getAllSitemapUrls()
  console.log(`📋 Found ${sitemapIndexUrls.length} sitemap indexes`)

  let totalDocuments = 0
  let totalSitemaps = 0
  let processedIndexes = 0

  // Sample first few indexes to estimate
  const sampleSize = Math.min(5, sitemapIndexUrls.length)
  console.log(`📊 Sampling first ${sampleSize} indexes to estimate...\n`)

  for (let i = 0; i < sampleSize; i++) {
    const indexUrl = sitemapIndexUrls[i]
    console.log(`Processing index ${i + 1}/${sampleSize}: ${indexUrl}`)

    try {
      const sitemapUrls = await fetchSitemapIndex(indexUrl)
      console.log(`  Found ${sitemapUrls.length} sitemaps`)

      let indexDocuments = 0
      for (const sitemapUrl of sitemapUrls) {
        try {
          const documents = await fetchSitemap(sitemapUrl)
          indexDocuments += documents.length
          totalSitemaps++
        } catch (error) {
          console.error(`    Error with ${sitemapUrl}:`, error)
        }

        // Add small delay to be respectful
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      totalDocuments += indexDocuments
      processedIndexes++
      console.log(`  Total documents in this index: ${indexDocuments}`)
    } catch (error) {
      console.error(`  Error processing index: ${error}`)
    }

    console.log()
  }

  // Calculate estimates
  const avgDocsPerIndex = totalDocuments / processedIndexes
  const estimatedTotal = Math.round(avgDocsPerIndex * sitemapIndexUrls.length)
  const avgDocsPerSitemap = totalDocuments / totalSitemaps

  console.log('📊 JUPORTAL Document Count Results:')
  console.log('=====================================')
  console.log(`Sitemap indexes found: ${sitemapIndexUrls.length}`)
  console.log(`Indexes sampled: ${processedIndexes}`)
  console.log(`Individual sitemaps processed: ${totalSitemaps}`)
  console.log(`Documents found in sample: ${totalDocuments}`)
  console.log(`Average documents per index: ${Math.round(avgDocsPerIndex)}`)
  console.log(`Average documents per sitemap: ${Math.round(avgDocsPerSitemap)}`)
  console.log(
    `\n🎯 ESTIMATED TOTAL DOCUMENTS: ~${estimatedTotal.toLocaleString()}`
  )

  console.log('\n📅 Date range covered:')
  const dates = sitemapIndexUrls
    .map((url) => {
      const match = url.match(/(\d{4}\/\d{2}\/\d{2})/)
      return match ? match[1] : null
    })
    .filter(Boolean)
    .sort()

  if (dates.length > 0) {
    console.log(`From: ${dates[0]} to ${dates[dates.length - 1]}`)
  }

  console.log('\n⚡ To import all documents, run:')
  console.log(`bun run scripts/fetch-all-juportal.ts 0 500 1000`)
  console.log('(start=0, batchSize=500, delay=1000ms)')

  return {
    totalIndexes: sitemapIndexUrls.length,
    sampledIndexes: processedIndexes,
    totalSitemaps,
    documentsInSample: totalDocuments,
    avgDocsPerIndex: Math.round(avgDocsPerIndex),
    estimatedTotal,
  }
}

// Execute if run directly
if (require.main === module) {
  countJUPORTALDocuments()
    .then(() => {
      console.log('\n✅ Count completed!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Error:', error)
      process.exit(1)
    })
}

export { countJUPORTALDocuments }
