'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import * as Icons from 'lucide-react'

interface Statistics {
  total: number
  queued: number
  processing: number
  completed: number
  failed: number
  avgProcessingTimeMs: number
  successRate: number
  queueDepth: number
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/stats')

      if (response.status === 403) {
        router.push('/dashboard')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }

      const data = await response.json()
      setStats(data.statistics)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    fetchStats()
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Icons.Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <div className="container mx-auto p-6">
          <div className="text-destructive">Failed to load statistics</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            System overview and job queue statistics
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Jobs</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardDescription className="text-primary">
                Queue Depth
              </CardDescription>
              <CardTitle className="text-3xl text-primary">
                {stats.queueDepth}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {stats.queued} queued, {stats.processing} processing
              </div>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-green-700 dark:text-green-400">
                Success Rate
              </CardDescription>
              <CardTitle className="text-3xl text-green-700 dark:text-green-400">
                {stats.successRate.toFixed(1)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground">
                {stats.completed} completed
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardDescription className="text-red-700 dark:text-red-400">
                Failed Jobs
              </CardDescription>
              <CardTitle className="text-3xl text-red-700 dark:text-red-400">
                {stats.failed}
              </CardTitle>
            </CardHeader>
            {stats.failed > 0 && (
              <CardContent>
                <Link
                  href="/dashboard/admin/jobs?status=FAILED"
                  className="text-xs text-primary hover:underline"
                >
                  View failed jobs →
                </Link>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle>Processing Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Avg Processing Time:
                </span>
                <span className="font-semibold">
                  {formatDuration(stats.avgProcessingTimeMs)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Success Rate:</span>
                <span className="font-semibold">
                  {stats.successRate.toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Queue Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Queued:</span>
                <span className="font-semibold">{stats.queued}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing:</span>
                <span className="font-semibold">{stats.processing}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button asChild className="w-full">
                <Link href="/dashboard/admin/providers">
                  <Icons.Cpu className="h-4 w-4 mr-2" />
                  LLM Providers
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/admin/models">
                  <Icons.Settings className="h-4 w-4 mr-2" />
                  Manage Models
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/admin/jobs">
                  <Icons.List className="h-4 w-4 mr-2" />
                  View All Jobs
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full border-red-200 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
              >
                <Link href="/dashboard/admin/jobs?status=FAILED">
                  <Icons.AlertCircle className="h-4 w-4 mr-2" />
                  Failed Jobs
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full border-green-200 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400"
              >
                <Link href="/dashboard/admin/jobs?status=PROCESSING">
                  <Icons.Play className="h-4 w-4 mr-2" />
                  Active Jobs
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
