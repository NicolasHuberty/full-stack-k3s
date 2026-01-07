import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { hasCollectionAccess } from '@/lib/collections/permissions'
import { prisma } from '@/lib/prisma'
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

    // Extract filename from fileUrl or use document.filename
    // fileUrl format: http://localhost:9000/docuralis/collection-id/file.pdf
    const urlParts = document.fileUrl.split('/')
    const filename = urlParts.slice(-2).join('/') // Get collection-id/file.pdf

    try {
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: filename,
      })
      const response = await s3Client.send(command)

      if (!response.Body) {
        return NextResponse.json(
          {
            error:
              'File not found in storage. The document may have failed to upload.',
          },
          { status: 404 }
        )
      }

      const bytes = await response.Body.transformToByteArray()

      // Return file with appropriate headers
      return new Response(bytes.buffer as ArrayBuffer, {
        headers: {
          'Content-Type': document.mimeType,
          'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalName)}"`,
          'Content-Length': bytes.length.toString(),
        },
      })
    } catch (fileError) {
      console.error('Failed to retrieve file from S3:', fileError)
      return NextResponse.json(
        {
          error:
            'File not found in storage. The document may have failed to upload.',
        },
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
