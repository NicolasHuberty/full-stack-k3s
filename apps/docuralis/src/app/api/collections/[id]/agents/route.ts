import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAgentService } from '@/lib/agents/service'
import { hasCollectionAccess } from '@/lib/collections/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: collectionId } = await params

    // Check access
    const hasAccess = await hasCollectionAccess(
      session.user.id,
      collectionId,
      'read'
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const agentService = getAgentService()
    const agents = await agentService.getCollectionAgents(collectionId)

    return NextResponse.json(agents)
  } catch (error) {
    console.error('Failed to get collection agents:', error)
    return NextResponse.json(
      { error: 'Failed to get collection agents' },
      { status: 500 }
    )
  }
}

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

    // Check access
    const hasAccess = await hasCollectionAccess(
      session.user.id,
      collectionId,
      'write'
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { agentId, actionState } = body

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    const agentService = getAgentService()
    const collectionAgent = await agentService.activateAgent(
      collectionId,
      agentId,
      actionState
    )

    return NextResponse.json(collectionAgent)
  } catch (error) {
    console.error('Failed to activate agent:', error)
    return NextResponse.json(
      { error: 'Failed to activate agent' },
      { status: 500 }
    )
  }
}
