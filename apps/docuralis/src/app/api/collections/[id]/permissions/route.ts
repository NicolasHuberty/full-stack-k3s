import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const addPermissionSchema = z.object({
  email: z.string().email(),
  permission: z.enum(['VIEWER', 'EDITOR', 'ADMIN']),
})

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
    const body = await request.json()
    const { email, permission } = addPermissionSchema.parse(body)

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

    // Find the user by email
    const targetUser = await prisma.user.findUnique({
      where: { email },
    })

    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found. They must have an account first.' },
        { status: 404 }
      )
    }

    // Check if permission already exists
    const existingPermission = await prisma.collectionPermission.findUnique({
      where: {
        collectionId_userId: {
          collectionId,
          userId: targetUser.id,
        },
      },
    })

    if (existingPermission) {
      return NextResponse.json(
        { error: 'User already has access to this collection' },
        { status: 400 }
      )
    }

    // Create the permission
    const newPermission = await prisma.collectionPermission.create({
      data: {
        collectionId,
        userId: targetUser.id,
        permission,
        grantedById: session.user.id,
      },
    })

    return NextResponse.json({ permission: newPermission })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to add permission:', error)
    return NextResponse.json(
      { error: 'Failed to add permission' },
      { status: 500 }
    )
  }
}
