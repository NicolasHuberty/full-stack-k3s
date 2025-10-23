import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { hasCollectionAccess } from '@/lib/collections/permissions'
import { getDocumentProcessor } from '@/lib/documents/processor'
import { prisma } from '@/lib/prisma'

// Upload document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: collectionId } = await params

    // Check write permission
    const hasAccess = await hasCollectionAccess(
      session.user.id,
      collectionId,
      'write'
    )
    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to upload documents to this collection',
        },
        { status: 403 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Process document
    const processor = getDocumentProcessor()
    const result = await processor.uploadDocument({
      collectionId,
      file: buffer,
      filename: file.name,
      mimeType: file.type,
      uploadedById: session.user.id,
    })

    // Convert BigInt to string
    const serializedDocument = {
      ...result.document,
      fileSize: result.document.fileSize.toString(),
      collection: {
        ...result.document.collection,
        storageUsed: result.document.collection.storageUsed.toString(),
      },
    }

    return NextResponse.json(
      {
        ...result,
        document: serializedDocument,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Failed to upload document:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}

// Get documents in collection
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: collectionId } = await params

    // Check read permission
    const hasAccess = await hasCollectionAccess(
      session.user.id,
      collectionId,
      'read'
    )
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this collection' },
        { status: 403 }
      )
    }

    const documents = await prisma.document.findMany({
      where: { collectionId },
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        _count: {
          select: {
            chunks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Convert BigInt to string
    const serializedDocuments = documents.map((doc) => ({
      ...doc,
      fileSize: doc.fileSize.toString(),
    }))

    return NextResponse.json({ documents: serializedDocuments })
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}
