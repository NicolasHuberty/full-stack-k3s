import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bulkRetryFailedJobs } from '@/lib/admin/jobs'
import { getDocumentProcessor } from '@/lib/documents/processor'

/**
 * POST /api/admin/jobs/bulk-retry - Retry multiple failed jobs
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is system admin
    if (!(session.user as any).isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const { documentIds } = await request.json()

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: 'Document IDs required' }, { status: 400 })
    }

    // Update job statuses
    const count = await bulkRetryFailedJobs(documentIds)

    // Queue each job for processing
    const processor = getDocumentProcessor()
    const promises = documentIds.map(id => processor.retryProcessing(id).catch(err => {
      console.error(`Failed to retry document ${id}:`, err)
      return null
    }))

    await Promise.all(promises)

    return NextResponse.json({
      success: true,
      message: `${count} jobs queued for retry`,
      count,
    })
  } catch (error) {
    console.error('Failed to bulk retry jobs:', error)
    return NextResponse.json(
      {
        error: 'Failed to bulk retry jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
