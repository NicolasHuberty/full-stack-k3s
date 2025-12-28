/**
 * Script to create payload indexes on existing Qdrant collections
 * This is a one-time optimization for collections with many points
 *
 * Run with: DATABASE_URL="..." npx tsx scripts/create-qdrant-indexes.ts
 */

import { QdrantClient } from '@qdrant/js-client-rest'

async function main() {
  const client = new QdrantClient({
    url: process.env.QDRANT_URL || 'https://qdrant.docuralis.com',
    port: 443,
    apiKey: process.env.QDRANT_API_KEY,
  })

  console.log('Connecting to Qdrant...')
  console.log('URL:', process.env.QDRANT_URL || 'https://qdrant.docuralis.com')

  // Get all collections
  const collections = await client.getCollections()
  console.log(`\nFound ${collections.collections.length} collections:`)

  for (const collection of collections.collections) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Collection: ${collection.name}`)

    // Get collection info
    const info = await client.getCollection(collection.name)
    console.log(`  Points count: ${info.points_count}`)
    console.log(`  Vectors count: ${info.vectors_count}`)
    console.log(`  Indexed vectors: ${info.indexed_vectors_count}`)

    // Check existing indexes
    const existingIndexes = Object.keys(info.payload_schema || {})
    console.log(
      `  Existing payload indexes: ${existingIndexes.join(', ') || 'none'}`
    )

    // Create missing indexes
    const requiredIndexes = ['collectionId', 'documentId']

    for (const indexField of requiredIndexes) {
      if (!existingIndexes.includes(indexField)) {
        console.log(`\n  Creating index on '${indexField}'...`)
        try {
          await client.createPayloadIndex(collection.name, {
            field_name: indexField,
            field_schema: 'keyword',
            wait: true,
          })
          console.log(`  ✓ Index '${indexField}' created successfully`)
        } catch (error: unknown) {
          const errMsg = error instanceof Error ? error.message : String(error)
          if (errMsg?.includes('already exists')) {
            console.log(`  ⚠ Index '${indexField}' already exists`)
          } else {
            console.error(`  ✗ Failed to create index '${indexField}':`, errMsg)
          }
        }
      } else {
        console.log(`  ✓ Index '${indexField}' already exists`)
      }
    }

    // Also create chunkIndex as integer index
    if (!existingIndexes.includes('chunkIndex')) {
      console.log(`\n  Creating index on 'chunkIndex'...`)
      try {
        await client.createPayloadIndex(collection.name, {
          field_name: 'chunkIndex',
          field_schema: 'integer',
          wait: true,
        })
        console.log(`  ✓ Index 'chunkIndex' created successfully`)
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error)
        if (errMsg?.includes('already exists')) {
          console.log(`  ⚠ Index 'chunkIndex' already exists`)
        } else {
          console.error(`  ✗ Failed to create index 'chunkIndex':`, errMsg)
        }
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('Done! All indexes have been created.')
  console.log(
    '\nNote: For large collections, index creation may take a few minutes.'
  )
  console.log('Qdrant will continue indexing in the background if needed.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })
