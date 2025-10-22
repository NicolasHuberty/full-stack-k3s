import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { hasCollectionAccess } from '@/lib/collections/permissions'
import { getDocumentProcessor } from '@/lib/documents/processor'
import { prisma } from '@/lib/prisma'

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
      include: {
        collection: {
          select: {
            id: true,
            name: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        chunks: {
          select: {
            id: true,
            chunkIndex: true,
            content: true,
            tokenCount: true,
          },
          orderBy: {
            chunkIndex: 'asc',
          },
        },
        processingJob: true,
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

    // Convert BigInt to string
    const serializedDocument = {
      ...document,
      fileSize: document.fileSize.toString(),
    }

    return NextResponse.json({ document: serializedDocument })
  } catch (error) {
    console.error('Failed to fetch document:', error)
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
      select: { collectionId: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    // Check delete permission
    const hasAccess = await hasCollectionAccess(
      session.user.id,
      document.collectionId,
      'write'
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this document' },
        { status: 403 }
      )
    }

    const processor = getDocumentProcessor()
    await processor.deleteDocument(id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete document:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}
