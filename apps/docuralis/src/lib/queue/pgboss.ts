import { PgBoss } from 'pg-boss'
import { logger } from '@/lib/logger'

let pgBossInstance: PgBoss | null = null
let isInitializing = false

export interface JobOptions {
  priority?: number
  retryLimit?: number
  retryDelay?: number
  retryBackoff?: boolean
  expireInSeconds?: number
  singletonKey?: string
}

export interface DocumentProcessingJobData {
  documentId: string
  collectionId: string
  userId: string
  priority?: number
}

/**
 * Get or initialize the PgBoss instance
 */
export async function getPgBoss(): Promise<PgBoss> {
  if (pgBossInstance) {
    return pgBossInstance
  }

  if (isInitializing) {
    // Wait for initialization to complete
    await new Promise((resolve) => setTimeout(resolve, 100))
    return getPgBoss()
  }

  isInitializing = true

  try {
    // Stop any existing instance first (in case of hot-reload)
    if (pgBossInstance) {
      try {
        await pgBossInstance.stop({ timeout: 5000 })
      } catch {
        // Ignore errors during cleanup
      }
      pgBossInstance = null
    }

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    pgBossInstance = new PgBoss({
      connectionString: databaseUrl,
      // Database connection configuration
      max: parseInt(process.env.PGBOSS_MAX_CONNECTIONS || '5'),
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 60000,

      // Disable monitoring and scheduling features to reduce DB connections
      schedule: false,
      supervise: false,
      migrate: true,
      createSchema: true,

      // Schema
      schema: 'pgboss',
    })

    // Handle errors
    pgBossInstance.on('error', (error) => {
      logger.error('PgBoss error:', error)
    })

    // Handle warnings
    pgBossInstance.on('warning', (warning) => {
      logger.warn('PgBoss warning:', warning)
    })

    await pgBossInstance.start()
    logger.info('PgBoss started successfully')

    // Create the process-document queue if it doesn't exist
    try {
      await pgBossInstance.createQueue('process-document', {
        policy: 'standard',
        retryLimit: 10,
        retryDelay: 60,
        retryBackoff: true,
        expireInSeconds: 82800, // 23 hours
      })
      logger.info('Queue process-document registered')
    } catch (error) {
      // Queue might already exist, that's fine
      logger.warn('Could not create queue, it may already exist:', error)
    }

    // Setup graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down PgBoss...')
      if (pgBossInstance) {
        await pgBossInstance.stop({ timeout: 30000 })
        pgBossInstance = null
        logger.info('PgBoss stopped')
      }
    }

    process.on('SIGTERM', shutdown)
    process.on('SIGINT', shutdown)

    return pgBossInstance
  } catch (error) {
    isInitializing = false
    logger.error('Failed to initialize PgBoss:', error)
    throw error
  } finally {
    isInitializing = false
  }
}

/**
 * Send a document processing job to the queue
 */
export async function sendDocumentProcessingJob(
  data: DocumentProcessingJobData,
  options?: JobOptions
): Promise<string> {
  const boss = await getPgBoss()

  const defaultOptions: JobOptions = {
    priority: data.priority || 0,
    retryLimit: parseInt(process.env.PGBOSS_RETRY_LIMIT || '10'),
    retryDelay: parseInt(process.env.PGBOSS_RETRY_DELAY || '60'), // seconds
    retryBackoff: true,
    expireInSeconds: 82800, // 23 hours (must be less than 24 hours for pg-boss 12.x)
    singletonKey: data.documentId, // Prevent duplicate jobs for same document
  }

  const jobOptions = { ...defaultOptions, ...options }

  const jobId = await boss.send('process-document', data, jobOptions)

  if (!jobId) {
    throw new Error('Failed to send job to queue')
  }

  logger.info('Document processing job sent', {
    jobId,
    documentId: data.documentId,
  })
  return jobId
}

/**
 * Get job status
 */
export async function getJobStatus(jobId: string) {
  const boss = await getPgBoss()
  return await boss.getJobById('process-document', jobId)
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<void> {
  const boss = await getPgBoss()
  await boss.cancel('process-document', jobId)
  logger.info('Job cancelled', { jobId })
}

/**
 * Resume a failed job
 */
export async function resumeJob(jobId: string): Promise<void> {
  const boss = await getPgBoss()
  await boss.resume('process-document', jobId)
  logger.info('Job resumed', { jobId })
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
  const boss = await getPgBoss()

  try {
    // Get queue stats using the new API
    const stats = await boss.getQueueStats('process-document')

    return {
      deferred: stats.deferredCount,
      queued: stats.queuedCount,
      active: stats.activeCount,
      total: stats.totalCount,
      singletonsActive: stats.singletonsActive,
    }
  } catch {
    // Queue doesn't exist yet, return zero stats
    logger.warn(
      'Queue process-document does not exist yet, returning zero stats'
    )
    return {
      deferred: 0,
      queued: 0,
      active: 0,
      total: 0,
      singletonsActive: null,
    }
  }
}

/**
 * Cleanup - for use in tests or manual cleanup
 */
export async function cleanupPgBoss(): Promise<void> {
  if (pgBossInstance) {
    await pgBossInstance.stop()
    pgBossInstance = null
  }
}
