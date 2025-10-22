import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getCollection,
  updateCollection,
  deleteCollection,
} from '@/lib/collections/service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateCollectionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  visibility: z.enum(['PRIVATE', 'ORGANIZATION', 'PUBLIC']).optional(),
  allowPublicRead: z.boolean().optional(),
  embeddingModel: z.string().optional(),
  chunkSize: z.number().min(100).max(4000).optional(),
  chunkOverlap: z.number().min(0).max(1000).optional(),
})

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

    const collection = await getCollection(id, session.user.id)

    // Fetch documents for this collection
    const documents = await prisma.document.findMany({
      where: { collectionId: id },
      include: {
        uploadedBy: {
          select: {
            name: true,
            email: true,
            image: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get additional stats
    const [
      accessStats,
      lastDocumentUpdate,
      lastChatActivity,
      chatMessageCount,
    ] = await Promise.all([
      // Get all users with access (permissions + owner)
      prisma.collectionPermission.findMany({
        where: { collectionId: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      }),
      // Get last updated document
      prisma.document.findFirst({
        where: { collectionId: id },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      }),
      // Get last chat message date
      prisma.chatMessage.findFirst({
        where: {
          session: {
            collectionId: id,
          },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      // Count total chat messages
      prisma.chatMessage.count({
        where: {
          session: {
            collectionId: id,
          },
        },
      }),
    ])

    // Build access users list (owner + permissions)
    const accessUsers = []

    // Add owner as ADMIN
    if (collection.owner) {
      accessUsers.push({
        id: collection.owner.id,
        name: collection.owner.name,
        email: collection.owner.email,
        image: collection.owner.image,
        permission: 'ADMIN' as const,
      })
    }

    // Add users with explicit permissions (exclude owner to avoid duplicates)
    accessStats.forEach((p) => {
      if (p.user.id !== collection.ownerId) {
        accessUsers.push({
          ...p.user,
          permission: p.permission,
        })
      }
    })

    // Convert BigInt to string
    const serializedCollection = {
      ...collection,
      storageUsed: collection.storageUsed.toString(),
      documentCount: collection._count?.documents || 0,
      documents: documents.map((doc) => ({
        ...doc,
        fileSize: doc.fileSize.toString(),
      })),
      // Additional stats
      accessUsers,
      lastDocumentUpdate: lastDocumentUpdate?.updatedAt?.toISOString() || null,
      lastChatActivity: lastChatActivity?.createdAt?.toISOString() || null,
      totalChatMessages: chatMessageCount,
    }

    return NextResponse.json({ collection: serializedCollection })
  } catch (error) {
    console.error('Failed to fetch collection:', error)

    if (error instanceof Error) {
      if (error.message.includes('access')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to fetch collection' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const validatedData = updateCollectionSchema.parse(body)

    const collection = await updateCollection(
      id,
      session.user.id,
      validatedData
    )

    // Convert BigInt to string
    const serializedCollection = {
      ...collection,
      storageUsed: collection.storageUsed.toString(),
    }

    return NextResponse.json({ collection: serializedCollection })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update collection:', error)

    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to update collection' },
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

    await deleteCollection(id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete collection:', error)

    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete collection' },
      { status: 500 }
    )
  }
}
