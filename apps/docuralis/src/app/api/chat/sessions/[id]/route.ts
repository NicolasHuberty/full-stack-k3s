import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRAGService } from '@/lib/rag/service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const ragService = getRAGService()
    const chatSession = await ragService.getSession(id, session.user.id)

    return NextResponse.json({ session: chatSession })
  } catch (error) {
    console.error('Failed to fetch session:', error)

    if (error instanceof Error) {
      if (
        error.message.includes('access') ||
        error.message.includes('not found')
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { title } = body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
    }

    const ragService = getRAGService()
    const updatedSession = await ragService.updateSessionTitle(
      id,
      session.user.id,
      title.trim()
    )

    return NextResponse.json({ session: updatedSession })
  } catch (error) {
    console.error('Failed to update session:', error)

    if (error instanceof Error) {
      if (
        error.message.includes('permission') ||
        error.message.includes('access')
      ) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const ragService = getRAGService()
    await ragService.deleteSession(id, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete session:', error)

    if (error instanceof Error) {
      if (error.message.includes('permission')) {
        return NextResponse.json({ error: error.message }, { status: 403 })
      }
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
