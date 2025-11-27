'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import * as Icons from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import {
  subDays,
  startOfMonth,
  format,
  startOfWeek,
  endOfWeek,
  isSameWeek,
  isSameMonth,
  parseISO,
} from 'date-fns'

interface UserStats {
  user: {
    id: string
    name: string | null
    email: string
    image: string | null
  }
  totalTokens: number
  totalCost: number
  messageCount: number
}

interface OrgStats {
  organization: {
    id: string
    name: string
  }
  totalTokens: number
  totalCost: number
  messageCount: number
}

interface ModelStats {
  model: string
  totalTokens: number
  totalCost: number
  messageCount: number
}

interface ChartDataPoint {
  date: string
  total?: number
  [key: string]: string | number | undefined // Allow dynamic provider properties
}

interface CostData {
  byUser: UserStats[]
  byOrganization: OrgStats[]
  byModel: ModelStats[]
  chartData: ChartDataPoint[]
  warnings: string[]
}

interface FilterOptions {
  providers: { id: string; name: string }[]
  models: { name: string; providerId: string }[]
  users: { id: string; name: string | null; email: string }[]
  organizations: { id: string; name: string }[]
}

type Granularity = 'daily' | 'weekly' | 'monthly'

export default function CostDashboardPage() {
  const [data, setData] = useState<CostData | null>(null)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'orgs' | 'models'>(
    'users'
  )
  const [searchQuery, setSearchQuery] = useState('')

  // Date Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [granularity, setGranularity] = useState<Granularity>('daily')

  // Advanced Filters
  const [selectedProvider, setSelectedProvider] = useState<string>('all')
  const [selectedModel, setSelectedModel] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [selectedOrg, setSelectedOrg] = useState<string>('all')

  // Provider colors for chart
  const providerColors = useMemo(() => {
    const colors = [
      '#3b82f6', // Blue
      '#10b981', // Green
      '#f59e0b', // Amber
      '#ef4444', // Red
      '#8b5cf6', // Violet
      '#ec4899', // Pink
      '#06b6d4', // Cyan
      '#f97316', // Orange
    ]
    const colorMap = new Map<string, string>()
    filterOptions?.providers.forEach((provider, index) => {
      colorMap.set(provider.id, colors[index % colors.length])
    })
    return colorMap
  }, [filterOptions])

  // Get unique provider IDs from chart data
  const chartProviderIds = useMemo(() => {
    if (!data?.chartData || data.chartData.length === 0) return []
    const providerIds = new Set<string>()
    data.chartData.forEach((point) => {
      Object.keys(point).forEach((key) => {
        if (key !== 'date' && key !== 'total') {
          providerIds.add(key)
        }
      })
    })
    return Array.from(providerIds)
  }, [data])

  // Fetch Filter Options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const res = await fetch('/api/admin/costs?meta=true')
        if (res.ok) {
          const json = await res.json()
          setFilterOptions(json)
        }
      } catch (err) {
        console.error('Failed to fetch filter options', err)
      }
    }
    fetchOptions()
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)
        if (selectedProvider && selectedProvider !== 'all')
          params.append('providerId', selectedProvider)
        if (selectedModel && selectedModel !== 'all')
          params.append('model', selectedModel)
        if (selectedUser && selectedUser !== 'all')
          params.append('userId', selectedUser)
        if (selectedOrg && selectedOrg !== 'all')
          params.append('organizationId', selectedOrg)

        const res = await fetch(`/api/admin/costs?${params.toString()}`)
        if (!res.ok) {
          throw new Error('Failed to fetch cost data')
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [
    startDate,
    endDate,
    selectedProvider,
    selectedModel,
    selectedUser,
    selectedOrg,
  ])

  const setPreset = (preset: '7d' | '30d' | 'month' | 'all') => {
    const today = new Date()
    let start = ''
    let end = ''

    if (preset === '7d') {
      start = format(subDays(today, 7), 'yyyy-MM-dd')
      end = format(today, 'yyyy-MM-dd')
      setGranularity('daily')
    } else if (preset === '30d') {
      start = format(subDays(today, 30), 'yyyy-MM-dd')
      end = format(today, 'yyyy-MM-dd')
      setGranularity('daily')
    } else if (preset === 'month') {
      start = format(startOfMonth(today), 'yyyy-MM-dd')
      end = format(today, 'yyyy-MM-dd')
      setGranularity('daily')
    } else {
      // All time
      start = ''
      end = ''
      setGranularity('monthly')
    }

    setStartDate(start)
    setEndDate(end)
  }

  const processedChartData = useMemo(() => {
    if (!data?.chartData) return []

    if (granularity === 'daily') {
      return data.chartData
    }

    // For weekly/monthly, we need to aggregate both total and provider-specific costs
    const aggregated = new Map<string, ChartDataPoint>()

    data.chartData.forEach((point) => {
      const date = parseISO(point.date)
      let key = ''

      if (granularity === 'weekly') {
        key = format(startOfWeek(date), 'yyyy-MM-dd')
      } else if (granularity === 'monthly') {
        key = format(startOfMonth(date), 'yyyy-MM-dd')
      }

      const current = aggregated.get(key) || { date: key, total: 0 }

      // Aggregate all properties (total and provider-specific)
      Object.keys(point).forEach((prop) => {
        if (prop !== 'date') {
          const value = point[prop]
          if (typeof value === 'number') {
            current[prop] = ((current[prop] as number) || 0) + value
          }
        }
      })

      aggregated.set(key, current)
    })

    return Array.from(aggregated.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    )
  }, [data, granularity])

  const filteredUsers = useMemo(() => {
    if (!data) return []
    return data.byUser.filter(
      (item) =>
        item.user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.user.email.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [data, searchQuery])

  const filteredOrgs = useMemo(() => {
    if (!data) return []
    return data.byOrganization.filter((item) =>
      item.organization.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [data, searchQuery])

  const filteredModels = useMemo(() => {
    if (!data) return []
    return data.byModel.filter((item) =>
      item.model.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [data, searchQuery])

  const totalCost = useMemo(() => {
    if (!data) return 0
    // Sum from users is accurate for total cost
    return data.byUser.reduce((acc, curr) => acc + curr.totalCost, 0)
  }, [data])

  const totalTokens = useMemo(() => {
    if (!data) return 0
    return data.byUser.reduce((acc, curr) => acc + curr.totalTokens, 0)
  }, [data])

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <Icons.Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <Alert variant="destructive">
            <Icons.AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">LLM Cost Analysis</h1>
            <p className="text-muted-foreground mt-2">
              Track token usage and estimated costs.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex items-center gap-2 mb-2 sm:mb-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('7d')}
              >
                7d
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('30d')}
              >
                30d
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('month')}
              >
                Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPreset('all')}
              >
                All
              </Button>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-36"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                End Date
              </label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-36"
              />
            </div>
            {(startDate || endDate) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                title="Clear dates"
                className="mb-0.5"
              >
                <Icons.X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Advanced Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Provider
                </label>
                <Select
                  value={selectedProvider}
                  onValueChange={setSelectedProvider}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Providers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Providers</SelectItem>
                    {filterOptions?.providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Model
                </label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Models" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Models</SelectItem>
                    {filterOptions?.models
                      .filter(
                        (m) =>
                          selectedProvider === 'all' ||
                          m.providerId === selectedProvider
                      )
                      .map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  User
                </label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {filterOptions?.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Organization
                </label>
                <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Organizations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Organizations</SelectItem>
                    {filterOptions?.organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProvider('all')
                  setSelectedModel('all')
                  setSelectedUser('all')
                  setSelectedOrg('all')
                  setStartDate('')
                  setEndDate('')
                }}
              >
                <Icons.RotateCcw className="mr-2 h-4 w-4" />
                Reset Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Warnings */}
        {data?.warnings && data.warnings.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
            <Icons.AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <AlertTitle className="text-yellow-800 dark:text-yellow-300">
              Missing Pricing Information
            </AlertTitle>
            <AlertDescription className="text-yellow-700 dark:text-yellow-400">
              Costs could not be fully calculated for the following models
              because pricing is missing:{' '}
              <strong>{data.warnings.join(', ')}</strong>. Please update the
              model settings.
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Estimated Cost
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tokens Consumed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {totalTokens.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.byUser.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1.5">
              <CardTitle>Cost Trend</CardTitle>
              <CardDescription>Estimated cost over time</CardDescription>
            </div>
            <Select
              value={granularity}
              onValueChange={(v) => setGranularity(v as Granularity)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Granularity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="w-full">
              {processedChartData.length > 0 ? (
                <ResponsiveContainer
                  width="100%"
                  height={300}
                  minWidth={0}
                  minHeight={0}
                >
                  <BarChart data={processedChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) => {
                        const date = parseISO(value)
                        if (granularity === 'monthly') {
                          return format(date, 'MMM yyyy')
                        }
                        return format(date, 'MM/dd')
                      }}
                      fontSize={12}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${value}`}
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `$${value.toFixed(4)}`,
                        'Cost',
                      ]}
                      labelFormatter={(label) => {
                        const date = parseISO(label)
                        if (granularity === 'monthly') {
                          return format(date, 'MMMM yyyy')
                        }
                        if (granularity === 'weekly') {
                          return `Week of ${format(date, 'MMM dd, yyyy')}`
                        }
                        return format(date, 'PPP')
                      }}
                    />
                    <Legend />
                    {chartProviderIds.map((providerId) => {
                      const provider = filterOptions?.providers.find(
                        (p) => p.id === providerId
                      )
                      return (
                        <Bar
                          key={providerId}
                          dataKey={providerId}
                          stackId="a"
                          fill={providerColors.get(providerId) || '#3b82f6'}
                          name={provider?.name || providerId}
                          radius={[4, 4, 0, 0]}
                        />
                      )
                    })}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No data available for the selected period
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex space-x-2 bg-muted p-1 rounded-lg">
            <Button
              variant={activeTab === 'users' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('users')}
            >
              Users
            </Button>
            <Button
              variant={activeTab === 'orgs' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('orgs')}
            >
              Organizations
            </Button>
            <Button
              variant={activeTab === 'models' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('models')}
            >
              Models
            </Button>
          </div>
          <div className="relative w-full sm:w-64">
            <Icons.Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-right">Messages</TableHead>
                  <TableHead className="text-right">Total Tokens</TableHead>
                  <TableHead className="text-right">Est. Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeTab === 'users' ? (
                  filteredUsers.length > 0 ? (
                    filteredUsers.map((stat) => (
                      <TableRow key={stat.user.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {stat.user.name || 'Unknown'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {stat.user.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.messageCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.totalTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${stat.totalCost.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No users found
                      </TableCell>
                    </TableRow>
                  )
                ) : activeTab === 'orgs' ? (
                  filteredOrgs.length > 0 ? (
                    filteredOrgs.map((stat) => (
                      <TableRow key={stat.organization.id}>
                        <TableCell className="font-medium">
                          {stat.organization.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.messageCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {stat.totalTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${stat.totalCost.toFixed(4)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-8">
                        No organizations found
                      </TableCell>
                    </TableRow>
                  )
                ) : filteredModels.length > 0 ? (
                  filteredModels.map((stat) => (
                    <TableRow key={stat.model}>
                      <TableCell className="font-medium">
                        {stat.model}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.messageCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {stat.totalTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${stat.totalCost.toFixed(4)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      No models found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
