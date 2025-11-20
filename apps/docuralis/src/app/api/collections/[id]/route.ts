import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getCollection,
  updateCollection,
  deleteCollection,
  CollectionVisibility,
} from '@/lib/collections/service'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateCollectionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  visibility: z.nativeEnum(CollectionVisibility).optional(),
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

    // Documents are now fetched via /api/collections/[id]/documents endpoint
    // This keeps the collection metadata load fast
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const documents: any[] = []

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

    // Build access users list
    const accessUsers = []
    const userMap = new Map()

    // Add owner as ADMIN
    if (collection.owner) {
      userMap.set(collection.owner.id, {
        id: collection.owner.id,
        name: collection.owner.name,
        email: collection.owner.email,
        image: collection.owner.image,
        permission: 'ADMIN' as const,
      })
    }

    // Add users with explicit permissions
    accessStats.forEach(
      (p: {
        user: { id: string; [key: string]: unknown }
        permission: string
      }) => {
        if (!userMap.has(p.user.id)) {
          userMap.set(p.user.id, {
            ...p.user,
            permission: p.permission,
          })
        }
      }
    )

    // For ORGANIZATION visibility, add all organization members
    if (collection.visibility === 'ORGANIZATION' && collection.organizationId) {
      const orgMembers = await prisma.organizationMember.findMany({
        where: {
          organizationId: collection.organizationId,
          isActive: true,
        },
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
      })

      orgMembers.forEach(
        (member: { user: { id: string; [key: string]: unknown } }) => {
          if (!userMap.has(member.user.id)) {
            userMap.set(member.user.id, {
              ...member.user,
              permission: 'VIEWER' as const, // Default permission for org members
            })
          }
        }
      )
    }

    accessUsers.push(...userMap.values())

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
