import { prisma } from '../src/lib/prisma'
import { createCollection } from '../src/lib/collections/service'
import { processDocument } from '../src/lib/documents/processor'
import { promises as fs } from 'fs'
import path from 'path'

const ECLI_API_BASE = 'https://ecli.openjustice.be'

interface ECLIDocument {
  ecli: string
  court: string
  year: string
  content?: string
  metadata?: Record<string, unknown>
}

async function fetchECLIDocument(ecli: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${ECLI_API_BASE}/ecli/${ecli}`, {
      headers: {
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch ECLI ${ecli}: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Error fetching ECLI ${ecli}:`, error)
    return null
  }
}

async function fetchJUPORTALDocuments() {
  console.log('Starting JUPORTAL jurisprudence fetch...')

  // Sample ECLIs from different Belgian courts
  const sampleECLIs = [
    'ECLI:BE:RVSCDE:2020:247.760', // Council of State
    'ECLI:BE:CC:2020:141', // Constitutional Court
    'ECLI:BE:CTLIE:2017:ARR.20170718.3', // Other Courts
    'ECLI:BE:CASS:2021:ARR.20211125.1', // Court of Cassation
    'ECLI:BE:GHARB:2021:ARR.20210318.2', // Court of Appeal Brussels
  ]

  // Find or create a collection for JUPORTAL documents
  const userId = process.env.DEFAULT_USER_ID || 'system'

  let collection = await prisma.collection.findFirst({
    where: {
      name: 'JUPORTAL Jurisprudence',
      ownerId: userId
    }
  })

  if (!collection) {
    console.log('Creating JUPORTAL collection...')
    collection = await createCollection({
      name: 'JUPORTAL Jurisprudence',
      description: 'Belgian case law from JUPORTAL database',
      visibility: 'PRIVATE',
      ownerId: userId,
      embeddingModel: 'text-embedding-3-small',
      chunkSize: 1000,
      chunkOverlap: 200
    })
  }

  console.log(`Using collection: ${collection.name} (${collection.id})`)

  // Create temp directory for downloads
  const tempDir = path.join(process.cwd(), 'temp', 'juportal')
  await fs.mkdir(tempDir, { recursive: true })

  // Fetch and process each document
  for (const ecli of sampleECLIs) {
    console.log(`\nFetching ${ecli}...`)

    const doc = await fetchECLIDocument(ecli)

    if (doc) {
      // Save as JSON file temporarily
      const fileName = `${ecli.replace(/:/g, '_')}.json`
      const filePath = path.join(tempDir, fileName)

      await fs.writeFile(filePath, JSON.stringify(doc, null, 2))

      console.log(`Saved ${fileName}`)

      // Process and add to collection
      try {
        const file = new File([JSON.stringify(doc)], fileName, { type: 'application/json' })

        await processDocument({
          file,
          collectionId: collection.id,
          userId,
          metadata: {
            source: 'JUPORTAL',
            ecli,
            court: ecli.split(':')[2],
            year: ecli.split(':')[3]
          }
        })

        console.log(`Processed and added ${ecli} to collection`)
      } catch (error) {
        console.error(`Error processing ${ecli}:`, error)
      }
    }
  }

  console.log('\n✅ JUPORTAL fetch completed')
}

// Execute if run directly
if (require.main === module) {
  fetchJUPORTALDocuments()
    .then(() => {
      console.log('Done')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

export { fetchJUPORTALDocuments, fetchECLIDocument }