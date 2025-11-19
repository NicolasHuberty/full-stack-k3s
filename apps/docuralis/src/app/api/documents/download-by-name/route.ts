import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import AWS from 'aws-sdk'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { filename, collectionId } = body

    console.log('[DownloadByName] Request body:', { filename, collectionId })

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 })
    }

    // Use AWS S3 SDK for proper authentication
    const bucketName = process.env.MINIO_BUCKET_NAME || 'docuralis'
    const accessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin'
    const secretKey = process.env.MINIO_SECRET_KEY || 'minioadmin'

    console.log(`[DownloadByName] Using credentials: ${accessKey.substring(0, 4)}...${accessKey.slice(-4)}`)

    // Configure S3 client for MinIO
    const s3 = new AWS.S3({
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
      endpoint: 'https://s3.docuralis.com',
      region: 'us-east-1',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    })

    // Try different filename patterns
    const possiblePaths = [
      // With collection ID if provided
      collectionId ? `${collectionId}/${filename}` : null,
      // Direct filename
      filename,
      // Without query parameters
      filename.split('?')[0],
      // Try to extract collection from URL patterns
      ...(filename.includes('%2F') ? [decodeURIComponent(filename)] : []),
      // Common MinIO collection patterns - try with hardcoded collection ID if no collectionId provided
      !collectionId ? `cmhxblm5p00018001iwvrwdxq/${filename}` : null,
    ].filter(Boolean)

    let pdfBuffer: Buffer | null = null
    let foundPath: string | null = null

    // Try each possible path with AWS S3 SDK
    for (const path of possiblePaths) {
      try {
        console.log(`[DownloadByName] Trying path with AWS SDK: ${path}`)

        const params = {
          Bucket: bucketName,
          Key: path as string
        }

        const data = await s3.getObject(params).promise()

        if (data.Body) {
          const buffer = Buffer.from(data.Body as Uint8Array)

          // Check if it's actually a PDF (not HTML)
          const isPDF = buffer.length > 4 &&
                        buffer[0] === 0x25 && // %
                        buffer[1] === 0x50 && // P
                        buffer[2] === 0x44 && // D
                        buffer[3] === 0x46    // F

          if (isPDF) {
            console.log(`[DownloadByName] ✅ SUCCESS! Downloaded valid PDF at: ${path} (${buffer.length} bytes)`)
            pdfBuffer = buffer
            foundPath = path
            break
          } else {
            console.log(`[DownloadByName] File at ${path} is not a valid PDF (${buffer.length} bytes)`)
          }
        }
      } catch (pathError: any) {
        console.log(`[DownloadByName] Failed to get ${path}: ${pathError.code || pathError.message}`)
        continue // Try next path
      }
    }

    if (!pdfBuffer) {
      console.error(`[DownloadByName] File not found. Tried paths:`, possiblePaths)

      return NextResponse.json(
        {
          error: 'File not found in storage. Tried multiple paths.',
          paths: possiblePaths,
        },
        { status: 404 }
      )
    }

    console.log(`[DownloadByName] Successfully found valid PDF at: ${foundPath}, size: ${pdfBuffer.length} bytes`)

    // Return PDF buffer
    return new NextResponse(pdfBuffer as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length.toString(),
        'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
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