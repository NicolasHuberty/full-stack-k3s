import { prisma } from '@/lib/prisma'
import { getQueueStats } from '@/lib/queue/pgboss'
import { JobStatus, Prisma } from '@prisma/client'

export interface JobFilter {
  status?: JobStatus | JobStatus[]
  search?: string
  dateFrom?: Date
  dateTo?: Date
  priority?: number
}

export interface JobListOptions {
  page?: number
  pageSize?: number
  orderBy?: 'createdAt' | 'startedAt' | 'completedAt' | 'priority'
  orderDir?: 'asc' | 'desc'
}

export interface JobStatistics {
  total: number
  queued: number
  processing: number
  completed: number
  failed: number
  avgProcessingTimeMs: number
  successRate: number
  queueDepth: number
}

/**
 * Get job statistics
 */
export async function getJobStatistics(): Promise<JobStatistics> {
  const [counts, queueStats] = await Promise.all([
    prisma.processingJob.groupBy({
      by: ['status'],
      _count: true,
    }),
    getQueueStats(),
  ])

  const statusCounts = counts.reduce(
    (acc, curr) => {
      acc[curr.status.toLowerCase()] = curr._count
      return acc
    },
    { queued: 0, processing: 0, completed: 0, failed: 0 } as Record<string, number>
  )

  // Calculate average processing time
  const completedJobs = await prisma.processingJob.findMany({
    where: {
      status: 'COMPLETED',
      startedAt: { not: null },
      completedAt: { not: null },
    },
    select: {
      startedAt: true,
      completedAt: true,
    },
    take: 100, // Last 100 completed jobs for average
  })

  let avgProcessingTimeMs = 0
  if (completedJobs.length > 0) {
    const totalTime = completedJobs.reduce((sum, job) => {
      if (job.startedAt && job.completedAt) {
        return sum + (job.completedAt.getTime() - job.startedAt.getTime())
      }
      return sum
    }, 0)
    avgProcessingTimeMs = totalTime / completedJobs.length
  }

  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
  const successRate = total > 0 ? (statusCounts.completed / total) * 100 : 0

  return {
    total,
    queued: statusCounts.queued,
    processing: statusCounts.processing,
    completed: statusCounts.completed,
    failed: statusCounts.failed,
    avgProcessingTimeMs,
    successRate,
    queueDepth: queueStats.queued + queueStats.active,
  }
}

/**
 * List jobs with filtering and pagination
 */
export async function listJobs(filter: JobFilter = {}, options: JobListOptions = {}) {
  const {
    page = 1,
    pageSize = 50,
    orderBy = 'createdAt',
    orderDir = 'desc',
  } = options

  const where: Prisma.ProcessingJobWhereInput = {}

  // Status filter
  if (filter.status) {
    if (Array.isArray(filter.status)) {
      where.status = { in: filter.status }
    } else {
      where.status = filter.status
    }
  }

  // Date range filter
  if (filter.dateFrom || filter.dateTo) {
    where.createdAt = {}
    if (filter.dateFrom) {
      where.createdAt.gte = filter.dateFrom
    }
    if (filter.dateTo) {
      where.createdAt.lte = filter.dateTo
    }
  }

  // Priority filter
  if (filter.priority !== undefined) {
    where.priority = filter.priority
  }

  // Search filter (search in document name)
  if (filter.search) {
    where.document = {
      originalName: {
        contains: filter.search,
        mode: 'insensitive',
      },
    }
  }

  const [jobs, total] = await Promise.all([
    prisma.processingJob.findMany({
      where,
      include: {
        document: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            fileSize: true,
            status: true,
            collectionId: true,
            uploadedBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { [orderBy]: orderDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.processingJob.count({ where }),
  ])

  return {
    jobs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  }
}

/**
 * Get job details by ID
 */
export async function getJobById(jobId: string) {
  const job = await prisma.processingJob.findUnique({
    where: { id: jobId },
    include: {
      document: {
        include: {
          collection: {
            select: {
              id: true,
              name: true,
              embeddingModel: true,
              chunkSize: true,
              chunkOverlap: true,
            },
          },
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          chunks: {
            select: {
              id: true,
              chunkIndex: true,
              tokenCount: true,
            },
            orderBy: {
              chunkIndex: 'asc',
            },
          },
        },
      },
    },
  })

  return job
}

/**
 * Get job by document ID
 */
export async function getJobByDocumentId(documentId: string) {
  return await prisma.processingJob.findUnique({
    where: { documentId },
    include: {
      document: {
        include: {
          collection: true,
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })
}

/**
 * Get failed jobs count
 */
export async function getFailedJobsCount(): Promise<number> {
  return await prisma.processingJob.count({
    where: { status: 'FAILED' },
  })
}

/**
 * Get stuck jobs (processing for more than X minutes)
 */
export async function getStuckJobs(minutesThreshold: number = 30) {
  const threshold = new Date(Date.now() - minutesThreshold * 60 * 1000)

  return await prisma.processingJob.findMany({
    where: {
      status: 'PROCESSING',
      startedAt: {
        lt: threshold,
      },
    },
    include: {
      document: {
        select: {
          id: true,
          originalName: true,
          status: true,
        },
      },
    },
  })
}

/**
 * Get recent job activity (last N jobs)
 */
export async function getRecentJobActivity(limit: number = 20) {
  return await prisma.processingJob.findMany({
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      document: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          status: true,
        },
      },
    },
  })
}

/**
 * Bulk retry failed jobs
 */
export async function bulkRetryFailedJobs(documentIds: string[]) {
  const jobs = await prisma.processingJob.findMany({
    where: {
      documentId: { in: documentIds },
      status: 'FAILED',
    },
  })

  // Reset status for all jobs
  await prisma.processingJob.updateMany({
    where: {
      documentId: { in: documentIds },
      status: 'FAILED',
    },
    data: {
      status: 'QUEUED',
      error: null,
      failedAt: null,
      retryAfter: null,
    },
  })

  await prisma.document.updateMany({
    where: {
      id: { in: documentIds },
      status: 'FAILED',
    },
    data: {
      status: 'PENDING',
      processingError: null,
    },
  })

  return jobs.length
}

/**
 * Delete old completed jobs
 */
export async function deleteOldCompletedJobs(daysOld: number = 30) {
  const threshold = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

  const result = await prisma.processingJob.deleteMany({
    where: {
      status: 'COMPLETED',
      completedAt: {
        lt: threshold,
      },
    },
  })

  return result.count
}

/**
 * Get job processing timeline (for charts)
 */
export async function getJobProcessingTimeline(days: number = 7) {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const jobs = await prisma.processingJob.findMany({
    where: {
      createdAt: {
        gte: startDate,
      },
    },
    select: {
      status: true,
      createdAt: true,
      completedAt: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  // Group by day and status
  const timeline: Record<string, Record<JobStatus, number>> = {}

  jobs.forEach((job) => {
    const day = job.createdAt.toISOString().split('T')[0]
    if (!timeline[day]) {
      timeline[day] = {
        QUEUED: 0,
        PROCESSING: 0,
        COMPLETED: 0,
        FAILED: 0,
      }
    }
    timeline[day][job.status]++
  })

  return Object.entries(timeline).map(([date, counts]) => ({
    date,
    ...counts,
  }))
}
