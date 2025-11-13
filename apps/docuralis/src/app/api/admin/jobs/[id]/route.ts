import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getJobById } from '@/lib/admin/jobs'

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
 * GET /api/admin/jobs/[id] - Get job details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params
    const job = await getJobById(id)

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Serialize BigInt values before returning
    const serialized = serializeBigInt(job)

    return NextResponse.json(serialized)
  } catch (error) {
    console.error('Failed to get job:', error)
    return NextResponse.json({ error: 'Failed to get job' }, { status: 500 })
  }
}
