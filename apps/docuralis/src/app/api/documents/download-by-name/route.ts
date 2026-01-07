import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

// S3 client configuration
const s3Client = new S3Client({
  endpoint: `https://${process.env.S3_ENDPOINT || 's3.docuralis.com'}`,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
  },
  forcePathStyle: true,
})

const BUCKET_NAME = process.env.S3_BUCKET || 'docuralis'

async function downloadFromS3(key: string): Promise<Buffer | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    })
    const response = await s3Client.send(command)
    if (response.Body) {
      const bytes = await response.Body.transformToByteArray()
      return Buffer.from(bytes)
    }
  } catch {
    return null
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { filename, collectionId } = body
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    // Clean up filename - remove query parameters
    const cleanFilename = filename.split('?')[0]
    // Decode URL-encoded filenames
    const decodedFilename = cleanFilename.includes('%')
      ? decodeURIComponent(cleanFilename)
      : cleanFilename

    // Try different filename patterns
    const possiblePaths = [
      // With collection ID if provided
      collectionId ? `${collectionId}/${decodedFilename}` : null,
      // Direct filename
      decodedFilename,
      // If filename already contains a path separator, try as-is
      decodedFilename.includes('/') ? decodedFilename : null,
    ].filter((p): p is string => p !== null)

    let pdfBuffer: Buffer | null = null

    // Try each possible path
    for (const path of possiblePaths) {
      const buffer = await downloadFromS3(path)
      if (!buffer) continue

      // Check if it's actually a PDF (not HTML)
      const isPDF =
        buffer.length > 4 &&
        buffer[0] === 0x25 && // %
        buffer[1] === 0x50 && // P
        buffer[2] === 0x44 && // D
        buffer[3] === 0x46 // F

      if (isPDF) {
        pdfBuffer = buffer
        break
      }
    }

    if (!pdfBuffer) {
      return NextResponse.json(
        {
          error: 'File not found in storage.',
          triedPaths: possiblePaths,
        },
        { status: 404 }
      )
    }

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(decodedFilename.split('/').pop() || decodedFilename)}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Failed to download document by name:', error)
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    )
  }
}
