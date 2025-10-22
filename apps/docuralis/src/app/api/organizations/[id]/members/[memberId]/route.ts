import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { removeMemberFromOrganization, updateMemberRole, checkUserPermission } from '@/lib/organization'
import { z } from 'zod'

const updateRoleSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MEMBER, or VIEWER' }),
  }),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: organizationId, memberId } = await params

    // Check if user has permission to update roles (must be OWNER or ADMIN)
    const hasPermission = await checkUserPermission(
      session.user.id,
      organizationId,
      'ADMIN'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to update member roles in this organization' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = updateRoleSchema.parse(body)

    const updatedMember = await updateMemberRole(memberId, validatedData.role)

    return NextResponse.json({ member: updatedMember })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to update member role:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update member role' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: organizationId, memberId } = await params

    // Check if user has permission to remove members (must be OWNER or ADMIN)
    const hasPermission = await checkUserPermission(
      session.user.id,
      organizationId,
      'ADMIN'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to remove members from this organization' },
        { status: 403 }
      )
    }

    await removeMemberFromOrganization(organizationId, memberId)

    return NextResponse.json(
      { message: 'Member removed successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to remove member:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to remove member' },
      { status: 500 }
    )
  }
}
