import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getMinioClient } from '@/lib/storage/minio'

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

    // Get MinIO client
    const minioClient = getMinioClient()
    const bucketName = process.env.MINIO_BUCKET_NAME || 'docuralis'

    // Try different filename patterns
    const possiblePaths = [
      filename, // Direct filename
      collectionId ? `${collectionId}/${filename}` : null, // With collection ID if provided
      filename.split('?')[0], // Without query parameters
      // Try to extract collection from URL patterns
      ...(filename.includes('%2F') ? [decodeURIComponent(filename)] : []),
      // Common MinIO collection patterns - try with hardcoded collection ID
      `cmhxblm5p00018001iwvrwdxq/${filename}`,
    ].filter(Boolean)

    let pdfBuffer: Buffer | null = null
    let foundPath: string | null = null

    // Try each possible path
    for (const path of possiblePaths) {
      try {
        console.log(`[DownloadByName] Trying path: ${path}`)
        const exists = await minioClient.fileExists(path)

        if (exists) {
          console.log(`[DownloadByName] Found file at: ${path}`)
          const stream = await minioClient.getObject(bucketName, path)

          // Convert stream to buffer
          const chunks: Buffer[] = []
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk))
          }
          pdfBuffer = Buffer.concat(chunks)
          foundPath = path
          break
        }
      } catch (pathError) {
        console.log(`[DownloadByName] Path ${path} failed:`, pathError)
        continue // Try next path
      }
    }

    if (!pdfBuffer) {
      console.log(`[DownloadByName] File not found with standard paths, trying to search bucket...`)

      // Last resort: search the entire bucket for files ending with this filename
      try {
        const objects = []
        const objectStream = minioClient.listObjects(bucketName, '', true)

        for await (const obj of objectStream) {
          if (obj.name?.endsWith(filename)) {
            objects.push(obj.name)
          }
        }

        console.log(`[DownloadByName] Found ${objects.length} matching files:`, objects)

        if (objects.length > 0) {
          // Try the first matching file
          const matchedPath = objects[0]
          const stream = await minioClient.getObject(bucketName, matchedPath)
          const chunks: Buffer[] = []
          for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk))
          }
          pdfBuffer = Buffer.concat(chunks)
          foundPath = matchedPath
          console.log(`[DownloadByName] Successfully found file via search: ${matchedPath}`)
        }
      } catch (searchError) {
        console.error('[DownloadByName] Search failed:', searchError)
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

    console.log(`[DownloadByName] Successfully found file at: ${foundPath}, size: ${pdfBuffer.length} bytes`)

    // Return PDF buffer
    return new NextResponse(pdfBuffer, {
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