import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAgentService } from '@/lib/agents/service'
import { hasCollectionAccess } from '@/lib/collections/permissions'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: collectionId, agentId } = await params

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
    const { actionState } = body

    if (!actionState) {
      return NextResponse.json(
        { error: 'actionState is required' },
        { status: 400 }
      )
    }

    const agentService = getAgentService()
    const collectionAgent = await agentService.updateAgentActionState(
      collectionId,
      agentId,
      actionState
    )

    return NextResponse.json(collectionAgent)
  } catch (error) {
    console.error('Failed to update agent action state:', error)
    return NextResponse.json(
      { error: 'Failed to update agent action state' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; agentId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: collectionId, agentId } = await params

    // Check access
    const hasAccess = await hasCollectionAccess(
      session.user.id,
      collectionId,
      'write'
    )
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const agentService = getAgentService()
    await agentService.deactivateAgent(collectionId, agentId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to deactivate agent:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate agent' },
      { status: 500 }
    )
  }
}
