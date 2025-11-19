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

    // Pagination and filter parameters
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
    const cursor = searchParams.get('cursor') || undefined
    const search = searchParams.get('search') || undefined
    const filename = searchParams.get('filename') || undefined
    const status = searchParams.get('status') || undefined

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { collectionId }

    // Exact filename match takes precedence over search
    if (filename) {
      where.OR = [
        { originalName: { equals: filename, mode: 'insensitive' } },
        { filename: { equals: filename, mode: 'insensitive' } },
        { originalName: { contains: filename, mode: 'insensitive' } },
        { filename: { contains: filename, mode: 'insensitive' } },
      ]
    } else if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status && status !== 'all') {
      where.status = status
    }

    // Fetch documents with cursor-based pagination
    const documents = await prisma.document.findMany({
      where,
      select: {
        id: true,
        filename: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        processedAt: true,
        totalChunks: true,
        processingError: true,
        uploadedBy: {
          select: {
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1, // Fetch one extra to check if there are more
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1, // Skip the cursor document
      }),
    })

    // Check if there are more documents
    const hasMore = documents.length > limit
    const paginatedDocuments = hasMore ? documents.slice(0, limit) : documents

    // Get next cursor
    const nextCursor = hasMore
      ? paginatedDocuments[paginatedDocuments.length - 1].id
      : null

    // Convert BigInt to string
    const serializedDocuments = paginatedDocuments.map((doc) => ({
      ...doc,
      fileSize: doc.fileSize.toString(),
    }))

    return NextResponse.json({
      documents: serializedDocuments,
      nextCursor,
      hasMore,
    })
  } catch (error) {
    console.error('Failed to fetch documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}
