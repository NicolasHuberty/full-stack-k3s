import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updatePermissionSchema = z.object({
  permission: z.enum(['VIEWER', 'EDITOR', 'ADMIN']),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: collectionId, userId } = await params
    const body = await request.json()
    const { permission } = updatePermissionSchema.parse(body)

    // Check if user has admin access to this collection
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        permissions: {
          where: { userId: session.user.id },
        },
      },
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const isOwner = collection.ownerId === session.user.id
    const hasAdminPermission = collection.permissions.some(
      (p) => p.userId === session.user.id && p.permission === 'ADMIN'
    )

    if (!isOwner && !hasAdminPermission) {
      return NextResponse.json(
        { error: 'Only collection owners and admins can manage access' },
        { status: 403 }
      )
    }

    // Update the permission
    const updatedPermission = await prisma.collectionPermission.update({
      where: {
        collectionId_userId: {
          collectionId,
          userId,
        },
      },
      data: {
        permission,
      },
    })

    return NextResponse.json({ permission: updatedPermission })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update permission:', error)
    return NextResponse.json(
      { error: 'Failed to update permission' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: collectionId, userId } = await params

    // Check if user has admin access to this collection
    const collection = await prisma.collection.findUnique({
      where: { id: collectionId },
      include: {
        permissions: {
          where: { userId: session.user.id },
        },
      },
    })

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    const isOwner = collection.ownerId === session.user.id
    const hasAdminPermission = collection.permissions.some(
      (p) => p.userId === session.user.id && p.permission === 'ADMIN'
    )

    if (!isOwner && !hasAdminPermission) {
      return NextResponse.json(
        { error: 'Only collection owners and admins can manage access' },
        { status: 403 }
      )
    }

    // Delete the permission
    await prisma.collectionPermission.delete({
      where: {
        collectionId_userId: {
          collectionId,
          userId,
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete permission:', error)
    return NextResponse.json(
      { error: 'Failed to delete permission' },
      { status: 500 }
    )
  }
}
