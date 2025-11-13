'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/layout'

interface JobMetadata {
  [key: string]: unknown
}

interface JobDetails {
  id: string
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  priority: number
  attempts: number
  maxAttempts: number
  error?: string
  currentStep?: string
  pgBossJobId?: string
  workerId?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  failedAt?: string
  retryAfter?: string
  metadata?: JobMetadata
  document: {
    id: string
    originalName: string
    mimeType: string
    fileSize: string
    status: string
    collectionId: string
    uploadedBy: {
      id: string
      name: string
      email: string
    }
    collection: {
      id: string
      name: string
      embeddingModel: string
      chunkSize: number
      chunkOverlap: number
    }
    chunks: Array<{
      id: string
      chunkIndex: number
      tokenCount: number
    }>
  }
}

export default function JobDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [job, setJob] = useState<JobDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  const fetchJobDetails = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/jobs/${jobId}`)

      if (response.status === 403) {
        router.push('/dashboard')
        return
      }

      if (response.status === 404) {
        alert('Job not found')
        router.push('/dashboard/admin/jobs')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch job details')
      }

      const data = await response.json()
      setJob(data)
    } catch (error) {
      console.error('Failed to fetch job details:', error)
    } finally {
      setLoading(false)
    }
  }, [jobId, router])

  useEffect(() => {
    fetchJobDetails()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobDetails, 5000)
    return () => clearInterval(interval)
  }, [fetchJobDetails])

  const retryJob = async () => {
    if (!job) return

    setRetrying(true)
    try {
      const response = await fetch(`/api/admin/jobs/${jobId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: job.document.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to retry job')
      }

      alert('Job queued for retry')
      fetchJobDetails()
    } catch (error) {
      console.error('Failed to retry job:', error)
      alert(error instanceof Error ? error.message : 'Failed to retry job')
    } finally {
      setRetrying(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-green-600 bg-green-100'
      case 'FAILED':
        return 'text-red-600 bg-red-100'
      case 'PROCESSING':
        return 'text-blue-600 bg-blue-100'
      case 'QUEUED':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return '-'
      return date.toLocaleString()
    } catch {
      return '-'
    }
  }

  const formatFileSize = (bytes: string) => {
    const numBytes = parseInt(bytes)
    const kb = numBytes / 1024
    if (kb < 1024) return `${kb.toFixed(2)} KB`
    return `${(kb / 1024).toFixed(2)} MB`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-lg">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-800">Job not found</h2>
            <button
              onClick={() => router.push('/dashboard/admin/jobs')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Jobs
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <button
              onClick={() => router.push('/dashboard/admin/jobs')}
              className="text-blue-600 hover:text-blue-800 mb-2"
            >
              ← Back to Jobs
            </button>
            <h1 className="text-3xl font-bold">Job Details</h1>
          </div>
          {job.status === 'FAILED' && (
            <button
              onClick={retryJob}
              disabled={retrying}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {retrying ? 'Retrying...' : 'Retry Job'}
            </button>
          )}
        </div>

        {/* Status Overview */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-gray-600 text-sm">Current Status</span>
              <div className="mt-1">
                <span
                  className={`px-3 py-1 text-sm rounded-full ${getStatusColor(job.status)}`}
                >
                  {job.status}
                </span>
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Current Step</span>
              <div className="mt-1 font-medium">{job.currentStep || '-'}</div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Attempts</span>
              <div className="mt-1 font-medium">
                {job.attempts}/{job.maxAttempts}
              </div>
            </div>
          </div>
        </div>

        {/* Timing Information */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Timing</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600 text-sm">Created At</span>
              <div className="mt-1 font-medium">
                {formatDate(job.createdAt)}
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Started At</span>
              <div className="mt-1 font-medium">
                {formatDate(job.startedAt)}
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Completed At</span>
              <div className="mt-1 font-medium">
                {formatDate(job.completedAt)}
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Failed At</span>
              <div className="mt-1 font-medium">{formatDate(job.failedAt)}</div>
            </div>
          </div>
        </div>

        {/* Document Information */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Document</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-600 text-sm">Filename</span>
              <div className="mt-1 font-medium">
                {job.document.originalName}
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">MIME Type</span>
              <div className="mt-1 font-medium">{job.document.mimeType}</div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">File Size</span>
              <div className="mt-1 font-medium">
                {formatFileSize(job.document.fileSize)}
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Document Status</span>
              <div className="mt-1 font-medium">{job.document.status}</div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Uploaded By</span>
              <div className="mt-1 font-medium">
                {job.document.uploadedBy.name}
              </div>
              <div className="text-xs text-gray-500">
                {job.document.uploadedBy.email}
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Collection</span>
              <div className="mt-1 font-medium">
                {job.document.collection.name}
              </div>
            </div>
          </div>
        </div>

        {/* Processing Configuration */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Processing Configuration
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-gray-600 text-sm">Embedding Model</span>
              <div className="mt-1 font-medium">
                {job.document.collection.embeddingModel}
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Chunk Size</span>
              <div className="mt-1 font-medium">
                {job.document.collection.chunkSize} tokens
              </div>
            </div>
            <div>
              <span className="text-gray-600 text-sm">Chunk Overlap</span>
              <div className="mt-1 font-medium">
                {job.document.collection.chunkOverlap} tokens
              </div>
            </div>
          </div>
        </div>

        {/* Chunks */}
        <div className="bg-white shadow-md rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            Chunks ({job.document.chunks.length})
          </h2>
          {job.document.chunks.length > 0 ? (
            <div className="space-y-2">
              {job.document.chunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded"
                >
                  <span className="text-sm font-medium">
                    Chunk {chunk.chunkIndex + 1}
                  </span>
                  <span className="text-sm text-gray-600">
                    {chunk.tokenCount} tokens
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No chunks created yet</p>
          )}
        </div>

        {/* Error Information */}
        {job.error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-800 mb-4">Error</h2>
            <pre className="text-sm text-red-700 whitespace-pre-wrap">
              {job.error}
            </pre>
          </div>
        )}

        {/* Metadata */}
        {job.metadata && (
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Metadata</h2>
            <pre className="text-sm bg-gray-50 p-4 rounded overflow-auto">
              {JSON.stringify(job.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
