import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { cancelInvitation, checkUserPermission } from '@/lib/organization'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invitationId: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: organizationId, invitationId } = await params

    // Check if user has permission to manage invitations (must be OWNER or ADMIN)
    const hasPermission = await checkUserPermission(
      session.user.id,
      organizationId,
      'ADMIN'
    )

    if (!hasPermission) {
      return NextResponse.json(
        {
          error:
            'You do not have permission to cancel invitations for this organization',
        },
        { status: 403 }
      )
    }

    await cancelInvitation(invitationId)

    return NextResponse.json(
      {
        message: 'Invitation cancelled successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to cancel invitation:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to cancel invitation' },
      { status: 500 }
    )
  }
}
