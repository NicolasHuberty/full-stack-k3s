#!/usr/bin/env bun

import { prisma } from '@/lib/prisma'
import * as fs from 'fs/promises'
import * as path from 'path'
import AWS from 'aws-sdk'

// MinIO/S3 configuration
const s3 = new AWS.S3({
  endpoint: process.env.MINIO_ENDPOINT || 'https://minio.docuralis.com',
  accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
  s3ForcePathStyle: true,
  signatureVersion: 'v4',
  sslEnabled: process.env.MINIO_USE_SSL !== 'false',
})

const BUCKET_NAME = process.env.MINIO_BUCKET_NAME || 'docuralis'
const OUTPUT_DIR = path.join(process.cwd(), 'jurisprudence')

interface JurisprudenceDocument {
  id: string
  filename: string
  originalName: string
  title?: string | null
  extractedText?: string | null
  fileUrl?: string | null
  author?: string | null
  pageCount?: number | null
  language?: string | null
  createdAt: Date
  status: string
  mimeType: string
  fileSize: bigint
  collectionName?: string
  collectionId: string
}

async function ensureDirectoryExists(dir: string) {
  try {
    await fs.access(dir)
  } catch {
    await fs.mkdir(dir, { recursive: true })
  }
}

async function downloadFromS3(key: string): Promise<Buffer | null> {
  try {
    console.log(`  Attempting to download from S3: ${key}`)
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    }

    const data = await s3.getObject(params).promise()
    if (data.Body) {
      return Buffer.from(data.Body as Uint8Array)
    }
  } catch (error) {
    console.error(`  Failed to download ${key}:`, error)
  }
  return null
}

async function findAndDownloadPDF(
  documentId: string,
  filename: string,
  collectionId: string
): Promise<Buffer | null> {
  // Try different possible paths in S3
  const possiblePaths = [
    `collections/${collectionId}/${documentId}.pdf`,
    `collections/${collectionId}/${filename}`,
    `documents/${documentId}.pdf`,
    `documents/${filename}`,
    filename,
  ]

  for (const path of possiblePaths) {
    const pdfBuffer = await downloadFromS3(path)
    if (pdfBuffer) {
      // Verify it's actually a PDF
      const isPDF =
        pdfBuffer.length > 4 &&
        pdfBuffer[0] === 0x25 && // %
        pdfBuffer[1] === 0x50 && // P
        pdfBuffer[2] === 0x44 && // D
        pdfBuffer[3] === 0x46 // F

      if (isPDF) {
        console.log(`  ✓ Found PDF at: ${path}`)
        return pdfBuffer
      }
    }
  }

  return null
}

async function migrateJurisprudenceDocuments() {
  console.log('🚀 Starting jurisprudence documents migration...\n')

  // Create output directory
  await ensureDirectoryExists(OUTPUT_DIR)
  console.log(`📁 Output directory: ${OUTPUT_DIR}\n`)

  // Find all jurisprudence collections
  const jurisprudenceCollections = await prisma.collection.findMany({
    where: {
      OR: [
        { name: { contains: 'JUPORTAL', mode: 'insensitive' } },
        { name: { contains: 'jurisprudence', mode: 'insensitive' } },
        { name: { contains: 'juridique', mode: 'insensitive' } },
        { description: { contains: 'case law', mode: 'insensitive' } },
        { description: { contains: 'jurisprudence', mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  })

  console.log(
    `Found ${jurisprudenceCollections.length} jurisprudence collections:`
  )
  jurisprudenceCollections.forEach((col) => {
    console.log(`  - ${col.name} (${col.id})`)
  })
  console.log('')

  let totalDocuments = 0
  let successfulExports = 0
  let failedExports = 0

  for (const collection of jurisprudenceCollections) {
    console.log(`\n📚 Processing collection: ${collection.name}`)
    console.log('='.repeat(60))

    // Create collection subdirectory
    const collectionDir = path.join(
      OUTPUT_DIR,
      collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    )
    await ensureDirectoryExists(collectionDir)

    // Get all documents in this collection
    const documents = await prisma.document.findMany({
      where: {
        collectionId: collection.id,
      },
      select: {
        id: true,
        filename: true,
        originalName: true,
        title: true,
        extractedText: true,
        fileUrl: true,
        createdAt: true,
        status: true,
        mimeType: true,
        fileSize: true,
        author: true,
        pageCount: true,
        language: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log(`Found ${documents.length} documents in this collection`)

    // Save collection metadata
    const collectionMetadata = {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      documentCount: documents.length,
      exportDate: new Date().toISOString(),
    }

    await fs.writeFile(
      path.join(collectionDir, '_collection_metadata.json'),
      JSON.stringify(collectionMetadata, null, 2)
    )

    // Process each document
    for (const doc of documents) {
      totalDocuments++

      try {
        console.log(`\n📄 Processing: ${doc.title || doc.filename}`)

        // Extract ECLI if present
        const ecli =
          doc.title?.match(/ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+/)?.[0] ||
          doc.filename?.match(/ECLI:[A-Z]{2}:[A-Z]+:\d{4}:[A-Z0-9.]+/)?.[0]

        // Create safe filename
        const safeFilename = (ecli || doc.id)
          .replace(/[^a-z0-9._-]/gi, '_')
          .substring(0, 100)

        const docDir = path.join(collectionDir, safeFilename)
        await ensureDirectoryExists(docDir)

        // Save metadata
        const metadata = {
          id: doc.id,
          filename: doc.filename,
          originalName: doc.originalName,
          title: doc.title,
          ecli: ecli,
          fileUrl: doc.fileUrl,
          status: doc.status,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize.toString(),
          createdAt: doc.createdAt.toISOString(),
          author: doc.author,
          pageCount: doc.pageCount,
          language: doc.language,
        }

        await fs.writeFile(
          path.join(docDir, 'metadata.json'),
          JSON.stringify(metadata, null, 2)
        )
        console.log(`  ✓ Saved metadata`)

        // Save extracted text if available
        if (doc.extractedText) {
          const textFilename =
            doc.mimeType === 'text/html' ? 'content.html' : 'content.txt'

          await fs.writeFile(path.join(docDir, textFilename), doc.extractedText)
          console.log(
            `  ✓ Saved extracted text (${doc.extractedText.length} chars)`
          )
        }

        // Try to download and save PDF
        const pdfBuffer = await findAndDownloadPDF(
          doc.id,
          doc.filename,
          collection.id
        )

        if (pdfBuffer) {
          await fs.writeFile(path.join(docDir, 'document.pdf'), pdfBuffer)
          console.log(
            `  ✓ Saved PDF (${(pdfBuffer.length / 1024).toFixed(1)} KB)`
          )
        } else {
          console.log(`  ⚠ No PDF found`)
        }

        // Create a summary file for easy reading
        const summary = `JURISPRUDENCE DOCUMENT
${'='.repeat(50)}

Title: ${doc.title || 'N/A'}
ECLI: ${ecli || 'N/A'}
Filename: ${doc.filename}
Date: ${doc.createdAt.toISOString().split('T')[0]}
Status: ${doc.status}
URL: ${doc.fileUrl || 'N/A'}

METADATA:
Author: ${doc.author || 'N/A'}
Pages: ${doc.pageCount || 'N/A'}
Language: ${doc.language || 'N/A'}

EXTRACTED TEXT:
${'='.repeat(50)}
${doc.extractedText || 'No text available'}
`

        await fs.writeFile(path.join(docDir, 'SUMMARY.txt'), summary)

        successfulExports++
        console.log(`  ✅ Successfully exported`)
      } catch (error) {
        failedExports++
        console.error(`  ❌ Failed to export document ${doc.id}:`, error)

        // Save error log
        const errorLog = {
          documentId: doc.id,
          title: doc.title,
          filename: doc.filename,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        }

        await fs.appendFile(
          path.join(collectionDir, '_errors.log'),
          JSON.stringify(errorLog) + '\n'
        )
      }
    }
  }

  // Create global summary
  const globalSummary = {
    exportDate: new Date().toISOString(),
    collections: jurisprudenceCollections.length,
    totalDocuments,
    successfulExports,
    failedExports,
    outputDirectory: OUTPUT_DIR,
  }

  await fs.writeFile(
    path.join(OUTPUT_DIR, 'EXPORT_SUMMARY.json'),
    JSON.stringify(globalSummary, null, 2)
  )

  console.log('\n' + '='.repeat(60))
  console.log('🎉 MIGRATION COMPLETE!')
  console.log('='.repeat(60))
  console.log(`📊 Summary:`)
  console.log(`  - Collections processed: ${jurisprudenceCollections.length}`)
  console.log(`  - Total documents: ${totalDocuments}`)
  console.log(`  - Successfully exported: ${successfulExports}`)
  console.log(`  - Failed exports: ${failedExports}`)
  console.log(`  - Output directory: ${OUTPUT_DIR}`)
  console.log('\nDirectory structure:')
  console.log(`  ${OUTPUT_DIR}/`)
  console.log(`    ├── EXPORT_SUMMARY.json`)
  for (const col of jurisprudenceCollections) {
    const colName = col.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    console.log(`    ├── ${colName}/`)
    console.log(`    │   ├── _collection_metadata.json`)
    console.log(`    │   ├── _errors.log (if any errors)`)
    console.log(`    │   └── [document_folders]/`)
    console.log(`    │       ├── metadata.json`)
    console.log(`    │       ├── content.html or content.txt`)
    console.log(`    │       ├── document.pdf (if available)`)
    console.log(`    │       └── SUMMARY.txt`)
  }
}

// Execute the migration
if (require.main === module) {
  migrateJurisprudenceDocuments()
    .then(() => {
      console.log('\n✅ Migration completed successfully!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Migration failed:', error)
      process.exit(1)
    })
}

export { migrateJurisprudenceDocuments }
