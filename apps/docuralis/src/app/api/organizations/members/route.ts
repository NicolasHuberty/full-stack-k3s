import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

/**
 * Get all organization members that the current user can share with
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organizations
    const userOrgs = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      select: { organizationId: true },
    })

    const orgIds = userOrgs.map((org: { organizationId: string }) => org.organizationId)

    if (orgIds.length === 0) {
      return NextResponse.json({ members: [] })
    }

    // Get all members from user's organizations (excluding current user)
    const members = await prisma.organizationMember.findMany({
      where: {
        organizationId: { in: orgIds },
        isActive: true,
        userId: { not: session.user.id },
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
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        user: { name: 'asc' },
      },
    })

    // Deduplicate by user ID
    const uniqueMembers = new Map()
    members.forEach((member: { user: { id: string; [key: string]: unknown } }) => {
      if (!uniqueMembers.has(member.user.id)) {
        uniqueMembers.set(member.user.id, member.user)
      }
    })

    return NextResponse.json({ members: Array.from(uniqueMembers.values()) })
  } catch (error) {
    console.error('Failed to get organization members:', error)
    return NextResponse.json(
      { error: 'Failed to get organization members' },
      { status: 500 }
    )
  }
}
