import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  getJobStatistics,
  getStuckJobs,
  getRecentJobActivity,
  getJobProcessingTimeline,
} from '@/lib/admin/jobs'

/**
 * GET /api/admin/stats - Get system statistics
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is system admin
    if (!(session.user as any).isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const timelineDays = parseInt(searchParams.get('timelineDays') || '7')

    const [statistics, stuckJobs, recentActivity, timeline] = await Promise.all([
      getJobStatistics(),
      getStuckJobs(30),
      getRecentJobActivity(20),
      getJobProcessingTimeline(timelineDays),
    ])

    return NextResponse.json({
      statistics,
      stuckJobs,
      recentActivity,
      timeline,
    })
  } catch (error) {
    console.error('Failed to get statistics:', error)
    return NextResponse.json(
      { error: 'Failed to get statistics' },
      { status: 500 }
    )
  }
}
