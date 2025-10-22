import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { hasCollectionAccess } from '@/lib/collections/permissions'
import { prisma } from '@/lib/prisma'
import { getMinioClient } from '@/lib/storage/minio'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        fileUrl: true,
        collectionId: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check read permission
    const hasAccess = await hasCollectionAccess(
      session.user.id,
      document.collectionId,
      'read'
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this document' },
        { status: 403 }
      )
    }

    // Get MinIO client
    const minioClient = getMinioClient()
    const bucketName = process.env.MINIO_BUCKET_NAME || 'docuralis'

    // Extract filename from fileUrl or use document.filename
    // fileUrl format: http://localhost:9000/docuralis/collection-id/file.pdf
    const urlParts = document.fileUrl.split('/')
    const filename = urlParts.slice(-2).join('/') // Get collection-id/file.pdf

    try {
      // Check if file exists first
      const exists = await minioClient.fileExists(filename)
      if (!exists) {
        return NextResponse.json(
          { error: 'File not found in storage. The document may have failed to upload.' },
          { status: 404 }
        )
      }

      // Get file from MinIO
      const stream = await minioClient.getObject(bucketName, filename)

      // Convert stream to buffer
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk))
      }
      const buffer = Buffer.concat(chunks)

      // Return file with appropriate headers
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': document.mimeType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalName)}"`,
          'Content-Length': buffer.length.toString(),
        },
      })
    } catch (fileError) {
      console.error('Failed to retrieve file from MinIO:', fileError)
      return NextResponse.json(
        { error: 'File not found in storage. The document may have failed to upload.' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Failed to download document:', error)
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    )
  }
}
