import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { inviteMemberToOrganization, checkUserPermission } from '@/lib/organization'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER'], {
    errorMap: () => ({ message: 'Role must be ADMIN, MEMBER, or VIEWER' }),
  }),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: organizationId } = await params

    // Check if user has permission to invite (must be OWNER or ADMIN)
    const hasPermission = await checkUserPermission(
      session.user.id,
      organizationId,
      'ADMIN'
    )

    if (!hasPermission) {
      return NextResponse.json(
        { error: 'You do not have permission to invite members to this organization' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = inviteSchema.parse(body)

    const invitation = await inviteMemberToOrganization({
      organizationId,
      email: validatedData.email,
      role: validatedData.role,
      invitedById: session.user.id,
    })

    // Convert BigInt to string for JSON serialization
    const serializedInvitation = {
      ...invitation,
      organization: {
        ...invitation.organization,
        storageUsed: invitation.organization.storageUsed.toString(),
        storageLimit: invitation.organization.storageLimit.toString(),
      },
      invitedBy: invitation.invitedBy ? {
        ...invitation.invitedBy,
        storageUsed: invitation.invitedBy.storageUsed.toString(),
        storageLimit: invitation.invitedBy.storageLimit.toString(),
      } : null,
    }

    return NextResponse.json({ invitation: serializedInvitation }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to invite member:', error)

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to invite member' },
      { status: 500 }
    )
  }
}
