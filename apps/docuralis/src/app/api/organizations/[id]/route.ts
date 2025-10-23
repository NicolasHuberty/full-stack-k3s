import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { checkUserPermission } from '@/lib/organization'
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

    const { id: organizationId } = await params

    // Check if user is a member of this organization
    const hasPermission = await checkUserPermission(
      session.user.id,
      organizationId,
      'VIEWER'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      )
    }

    // Fetch organization with members and invitations
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                storageUsed: true,
                storageLimit: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
        invitations: {
          where: {
            status: 'PENDING',
          },
          include: {
            invitedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        collections: {
          select: {
            id: true,
            name: true,
            documentCount: true,
            storageUsed: true,
            visibility: true,
            createdAt: true,
          },
        },
      },
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Convert BigInt to string for JSON serialization
    const serializedOrg = {
      ...organization,
      storageUsed: organization.storageUsed.toString(),
      storageLimit: organization.storageLimit.toString(),
      members: organization.members.map((member) => ({
        ...member,
        user: {
          ...member.user,
          storageUsed: member.user.storageUsed
            ? member.user.storageUsed.toString()
            : '0',
          storageLimit: member.user.storageLimit
            ? member.user.storageLimit.toString()
            : '0',
        },
      })),
      collections: organization.collections.map((collection) => ({
        ...collection,
        storageUsed: collection.storageUsed.toString(),
      })),
    }

    return NextResponse.json({ organization: serializedOrg })
  } catch (error) {
    console.error('Failed to fetch organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}
