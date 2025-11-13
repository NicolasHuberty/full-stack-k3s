import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  resendInvitationEmail,
  checkUserPermission,
} from '@/lib/organization'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: organizationId, invitationId } = await params

    // Check if user has permission to invite (must be OWNER or ADMIN)
    const hasPermission = await checkUserPermission(
      session.user.id,
      organizationId,
      'ADMIN'
    )

    if (!hasPermission) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to resend invitations for this organization',
        },
        { status: 403 }
      )
    }

    const invitation = await resendInvitationEmail(invitationId)

    // Convert BigInt to string for JSON serialization
    const serializedInvitation = {
      ...invitation,
      organization: {
        ...invitation.organization,
        storageUsed: invitation.organization.storageUsed.toString(),
        storageLimit: invitation.organization.storageLimit.toString(),
      },
      invitedBy: invitation.invitedBy
        ? {
            ...invitation.invitedBy,
            storageUsed: invitation.invitedBy.storageUsed.toString(),
            storageLimit: invitation.invitedBy.storageLimit.toString(),
          }
        : null,
    }

    return NextResponse.json(
      { message: 'Invitation email resent successfully', invitation: serializedInvitation },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to resend invitation:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to resend invitation' },
      { status: 500 }
    )
  }
}

