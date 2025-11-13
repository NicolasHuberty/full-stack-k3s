import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { acceptInvitation } from '@/lib/organization'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await auth()

    console.log('Accept invitation - Session:', JSON.stringify(session, null, 2))

    if (!session?.user?.id) {
      console.error('No session or user ID found')
      return NextResponse.json(
        { error: 'Unauthorized. Please log in to accept the invitation.' },
        { status: 401 }
      )
    }

    const { token } = await params

    console.log('Accepting invitation with userId:', session.user.id, 'token:', token)

    const member = await acceptInvitation(token, session.user.id)

    console.log('Invitation accepted successfully:', member)

    return NextResponse.json(
      {
        message: 'Invitation accepted successfully',
        member,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to accept invitation:', error)

    if (error instanceof Error) {
      // Return specific error messages from the service
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    )
  }
}
