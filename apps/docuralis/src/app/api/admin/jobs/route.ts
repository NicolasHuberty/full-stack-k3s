import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { listJobs, JobFilter, JobListOptions } from '@/lib/admin/jobs'
import { JobStatus } from '@prisma/client'

/**
 * Convert BigInt values to strings for JSON serialization
 */
function serializeBigInt(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt)
  }

  if (typeof obj === 'object') {
    const serialized: Record<string, unknown> = {}
    for (const key in obj as Record<string, unknown>) {
      serialized[key] = serializeBigInt((obj as Record<string, unknown>)[key])
    }
    return serialized
  }

  return obj
}

/**
 * GET /api/admin/jobs - List jobs with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is system admin
    if (!(session.user as { isSystemAdmin?: boolean }).isSystemAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const searchParams = request.nextUrl.searchParams

    // Parse filters
    const filter: JobFilter = {}

    const status = searchParams.get('status')
    if (status) {
      if (status.includes(',')) {
        filter.status = status.split(',') as JobStatus[]
      } else {
        filter.status = status as JobStatus
      }
    }

    const search = searchParams.get('search')
    if (search) {
      filter.search = search
    }

    const dateFrom = searchParams.get('dateFrom')
    if (dateFrom) {
      filter.dateFrom = new Date(dateFrom)
    }

    const dateTo = searchParams.get('dateTo')
    if (dateTo) {
      filter.dateTo = new Date(dateTo)
    }

    const priority = searchParams.get('priority')
    if (priority) {
      filter.priority = parseInt(priority)
    }

    // Parse options
    const options: JobListOptions = {
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '50'),
      orderBy:
        (searchParams.get('orderBy') as
          | 'createdAt'
          | 'startedAt'
          | 'completedAt'
          | 'priority'
          | null) || 'createdAt',
      orderDir: (searchParams.get('orderDir') as 'asc' | 'desc') || 'desc',
    }

    const result = await listJobs(filter, options)

    // Serialize BigInt values before returning
    const serialized = serializeBigInt(result)

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('Failed to list jobs:', error)
    return NextResponse.json({ error: 'Failed to list jobs' }, { status: 500 })
  }
}
