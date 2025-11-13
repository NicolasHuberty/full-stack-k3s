import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRAGService } from '@/lib/rag/service'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const collectionId = searchParams.get('collectionId') || undefined
    const filter =
      (searchParams.get('filter') as 'owned' | 'shared' | 'all') || 'all'

    const ragService = getRAGService()
    const sessions = await ragService.getUserSessions(
      session.user.id,
      collectionId,
      filter
    )

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}
