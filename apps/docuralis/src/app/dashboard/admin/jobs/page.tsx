'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/layout'

interface Job {
  id: string
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  priority: number
  attempts: number
  maxAttempts: number
  error?: string
  currentStep?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
  document: {
    id: string
    originalName: string
    mimeType: string
    fileSize: bigint
    status: string
    uploadedBy: {
      name: string
      email: string
    }
  }
}

export default function AdminJobsPage() {
  const router = useRouter()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: '20',
      })

      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await fetch(`/api/admin/jobs?${params}`)

      if (response.status === 403) {
        router.push('/dashboard')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch jobs')
      }

      const data = await response.json()
      setJobs(data.jobs)
      setTotalPages(data.pagination.totalPages)
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, searchQuery, page, router])

  useEffect(() => {
    fetchJobs()
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchJobs, 5000)
    return () => clearInterval(interval)
  }, [fetchJobs])

  const retryJob = async (documentId: string) => {
    try {
      const response = await fetch(`/api/admin/jobs/${documentId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })

      if (!response.ok) {
        throw new Error('Failed to retry job')
      }

      fetchJobs()
    } catch (error) {
      console.error('Failed to retry job:', error)
      alert('Failed to retry job')
    }
  }

  const bulkRetry = async () => {
    if (selectedJobs.length === 0) return

    try {
      const response = await fetch('/api/admin/jobs/bulk-retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: selectedJobs }),
      })

      if (!response.ok) {
        throw new Error('Failed to retry jobs')
      }

      setSelectedJobs([])
      fetchJobs()
    } catch (error) {
      console.error('Failed to retry jobs:', error)
      alert('Failed to retry jobs')
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

  const formatFileSize = (bytes: bigint) => {
    const kb = Number(bytes) / 1024
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

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Job Queue Management</h1>
        <p className="text-gray-600 mt-2">Monitor and manage document processing jobs</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex gap-4 flex-wrap">
        <div>
          <label className="block text-sm font-medium mb-2">Status Filter</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="all">All</option>
            <option value="QUEUED">Queued</option>
            <option value="PROCESSING">Processing</option>
            <option value="COMPLETED">Completed</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-sm font-medium mb-2">Search</label>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by filename..."
            className="w-full px-4 py-2 border rounded-lg"
          />
        </div>

        {selectedJobs.length > 0 && (
          <div className="flex items-end">
            <button
              onClick={bulkRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retry Selected ({selectedJobs.length})
            </button>
          </div>
        )}
      </div>

      {/* Jobs Table */}
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                <input
                  type="checkbox"
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedJobs(jobs.map(j => j.document.id))
                    } else {
                      setSelectedJobs([])
                    }
                  }}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded By</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedJobs.includes(job.document.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedJobs([...selectedJobs, job.document.id])
                      } else {
                        setSelectedJobs(selectedJobs.filter(id => id !== job.document.id))
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium">{job.document.originalName}</div>
                  <div className="text-xs text-gray-500">{job.document.mimeType}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm">{job.document.uploadedBy.name}</div>
                  <div className="text-xs text-gray-500">{job.document.uploadedBy.email}</div>
                </td>
                <td className="px-4 py-3 text-sm">{formatFileSize(job.document.fileSize)}</td>
                <td className="px-4 py-3">
                  <div className="text-sm">
                    {job.currentStep || '-'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Attempt {job.attempts}/{job.maxAttempts}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{formatDate(job.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/dashboard/admin/jobs/${job.id}`)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View
                    </button>
                    {job.status === 'FAILED' && (
                      <button
                        onClick={() => retryJob(job.document.id)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {jobs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No jobs found
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
    </DashboardLayout>
  )
}
