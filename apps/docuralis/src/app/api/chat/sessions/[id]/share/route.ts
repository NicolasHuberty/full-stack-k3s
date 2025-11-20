import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const shareSchema = z.object({
  userIds: z.array(z.string()).min(1, 'At least one user must be selected'),
})

/**
 * Share a chat session with other users
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const body = await request.json()
    const { userIds } = shareSchema.parse(body)

    // Verify the session exists and user owns it
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      )
    }

    if (chatSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only share your own chats' },
        { status: 403 }
      )
    }

    // Get user's organization members to validate userIds
    const userOrgs = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: { organizationId: true },
    })

    const orgIds = userOrgs.map((org: { organizationId: string }) => org.organizationId)

    // Validate that all userIds are members of user's organizations
    const validUsers = await prisma.organizationMember.findMany({
      where: {
        userId: { in: userIds },
        organizationId: { in: orgIds },
        isActive: true,
      },
      select: { userId: true },
    })

    const validUserIds = validUsers.map((u: { userId: string }) => u.userId)
    const invalidUserIds = userIds.filter((id: string) => !validUserIds.includes(id))

    if (invalidUserIds.length > 0) {
      return NextResponse.json(
        {
          error: 'Some users are not members of your organizations',
          invalidUserIds,
        },
        { status: 400 }
      )
    }

    // Create share entries (skip duplicates)
    const shareData = validUserIds.map((userId: string) => ({
      sessionId,
      userId,
    }))

    await prisma.chatSharedWith.createMany({
      data: shareData,
      skipDuplicates: true,
    })

    // Get updated list of shared users
    const sharedWith = await prisma.chatSharedWith.findMany({
      where: { sessionId },
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
      orderBy: { sharedAt: 'desc' },
    })

    return NextResponse.json({ sharedWith }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to share chat session:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to share chat session' },
      { status: 500 }
    )
  }
}

/**
 * Get list of users the chat is shared with
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionId } = await params

    // Verify the session exists and user has access (owner or shared with)
    const chatSession = await prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        OR: [
          { userId: session.user.id },
          { sharedWith: { some: { userId: session.user.id } } },
        ],
      },
      select: { userId: true },
    })

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found or access denied' },
        { status: 404 }
      )
    }

    // Get shared users
    const sharedWith = await prisma.chatSharedWith.findMany({
      where: { sessionId },
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
      orderBy: { sharedAt: 'desc' },
    })

    return NextResponse.json({ sharedWith }, { status: 200 })
  } catch (error) {
    console.error('Failed to get shared users:', error)
    return NextResponse.json(
      { error: 'Failed to get shared users' },
      { status: 500 }
    )
  }
}

/**
 * Unshare chat session (remove specific user)
 * Use DELETE /api/chat/sessions/[id]/share/[userId] instead
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: sessionId } = await params
    const { searchParams } = new URL(request.url)
    const userIdToRemove = searchParams.get('userId')

    if (!userIdToRemove) {
      return NextResponse.json(
        { error: 'userId query parameter is required' },
        { status: 400 }
      )
    }

    // Verify the session exists and user owns it
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    })

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      )
    }

    if (chatSession.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'You can only unshare your own chats' },
        { status: 403 }
      )
    }

    // Remove share
    await prisma.chatSharedWith.deleteMany({
      where: {
        sessionId,
        userId: userIdToRemove,
      },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Failed to unshare chat session:', error)
    return NextResponse.json(
      { error: 'Failed to unshare chat session' },
      { status: 500 }
    )
  }
}
