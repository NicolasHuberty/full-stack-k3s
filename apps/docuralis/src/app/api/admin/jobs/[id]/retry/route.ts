import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getDocumentProcessor } from '@/lib/documents/processor'

/**
 * POST /api/admin/jobs/[id]/retry - Retry a failed job
 */
export async function POST(
  request: NextRequest,
  { params: _params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is system admin
    if (!(session.user as { isSystemAdmin?: boolean }).isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const processor = getDocumentProcessor()

    // The id here is the job ID, but we need the document ID
    // We'll need to get it from the job first
    const { documentId } = await request.json()

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID required' }, { status: 400 })
    }

    await processor.retryProcessing(documentId)

    return NextResponse.json({ success: true, message: 'Job retry queued' })
  } catch (error) {
    console.error('Failed to retry job:', error)
    return NextResponse.json(
      {
        error: 'Failed to retry job',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
