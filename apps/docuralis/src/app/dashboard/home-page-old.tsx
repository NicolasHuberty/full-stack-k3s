/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import {
  MessageSquare,
  Database,
  TrendingUp,
  Users,
  Clock,
  ArrowRight,
  Sparkles,
  FileText,
  Activity,
  HardDrive,
  Zap,
  BarChart3,
  Calendar,
  CheckCircle2,
  Circle,
  AlertCircle,
  Send,
  FolderOpen,
  Star,
  Plus
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatDistanceToNow, format, startOfWeek, endOfWeek, eachDayOfInterval, isToday } from 'date-fns'

export function DashboardHomePage() {
  const { data: session } = useSession()
  const router = useRouter()
  const t = useTranslations('dashboard')

  const [recentChats, setRecentChats] = useState<any[]>([])
  const [collections, setCollections] = useState<any[]>([])
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalChats: 0,
    totalCollections: 0,
    totalDocuments: 0,
    storageUsed: 0,
    storageLimit: 0
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    try {
      // Fetch recent chats
      const chatsRes = await fetch('/api/chat/sessions')
      if (chatsRes.ok) {
        const chatsData = await chatsRes.json()
        setRecentChats(chatsData.sessions?.slice(0, 5) || [])
        setStats(prev => ({ ...prev, totalChats: chatsData.sessions?.length || 0 }))
      }

      // Fetch collections
      const collectionsRes = await fetch('/api/collections')
      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json()
        setCollections(collectionsData.collections || [])
        setStats(prev => ({
          ...prev,
          totalCollections: collectionsData.collections?.length || 0,
          totalDocuments: collectionsData.collections?.reduce((sum: number, c: any) => sum + (c.documentCount || 0), 0) || 0,
          storageUsed: collectionsData.collections?.reduce((sum: number, c: any) => sum + parseInt(c.storageUsed || 0), 0) || 0
        }))
      }

      // Fetch team members
      const orgsRes = await fetch('/api/organizations')
      if (orgsRes.ok) {
        const orgsData = await orgsRes.json()
        if (orgsData.organizations?.length > 0) {
          const firstOrg = orgsData.organizations[0]
          const orgId = firstOrg.organization?.id || firstOrg.id

          const orgDetailsRes = await fetch(`/api/organizations/${orgId}`)
          if (orgDetailsRes.ok) {
            const orgDetails = await orgDetailsRes.json()
            setTeamMembers(orgDetails.organization?.members?.slice(0, 6) || [])
          }
        }
      }

      // Set storage limit from user session
      if (session?.user?.storageLimit) {
        setStats(prev => ({
          ...prev,
          storageLimit: parseInt(session.user.storageLimit)
        }))
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    }
  }

  const handleCreateChat = () => {
    router.push('/dashboard/chat')
  }

  const storagePercentage = stats.storageLimit > 0
    ? (stats.storageUsed / stats.storageLimit) * 100
    : 0

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header with Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {t('welcomeBack')}, {session?.user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-muted-foreground">{t('dashboardSubtitle')}</p>
        </div>
        <Button onClick={handleCreateChat} size="lg" className="gap-2">
          <Sparkles className="h-5 w-5" />
          {t('newChat')}
        </Button>
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('conversations')}</p>
                <p className="text-3xl font-bold mt-2">{stats.totalChats}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('totalChats')}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('collections')}</p>
                <p className="text-3xl font-bold mt-2">{stats.totalCollections}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('knowledgeBases')}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Database className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('documents')}</p>
                <p className="text-3xl font-bold mt-2">{stats.totalDocuments}</p>
                <p className="text-xs text-muted-foreground mt-1">{t('filesUploaded')}</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('storage')}</p>
                <p className="text-3xl font-bold mt-2">{(stats.storageUsed / 1024 / 1024 / 1024).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('of')} {(stats.storageLimit / 1024 / 1024 / 1024).toFixed(0)} GB
                </p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <HardDrive className="h-6 w-6 text-orange-500" />
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    storagePercentage > 90 ? 'bg-red-500' :
                    storagePercentage > 70 ? 'bg-orange-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity - Takes 2 columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Chats */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                {t('recentActivity')}
              </CardTitle>
              <Link href="/dashboard/chat">
                <Button variant="ghost" size="sm" className="gap-1">
                  {t('viewAll')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {recentChats.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground mb-4">{t('noRecentChats')}</p>
                  <Button onClick={handleCreateChat} variant="outline">
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('startFirstChat')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentChats.map((chat) => (
                    <Link
                      key={chat.id}
                      href={`/dashboard/chat?session=${chat.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <MessageSquare className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{chat.title || t('untitledChat')}</p>
                          <p className="text-sm text-muted-foreground">
                            {chat._count?.messages || 0} {t('messages')} • {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                {t('quickActions')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Button
                  onClick={handleCreateChat}
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                >
                  <MessageSquare className="h-6 w-6 text-primary" />
                  <span className="text-sm font-medium">{t('newChat')}</span>
                </Button>
                <Link href="/dashboard/collections">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex-col gap-2"
                  >
                    <Database className="h-6 w-6 text-purple-500" />
                    <span className="text-sm font-medium">{t('manageCollections')}</span>
                  </Button>
                </Link>
                <Link href="/dashboard/teams">
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex-col gap-2"
                  >
                    <Users className="h-6 w-6 text-blue-500" />
                    <span className="text-sm font-medium">{t('inviteTeam')}</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Team & Collections */}
        <div className="space-y-6">
          {/* Team Members */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-primary" />
                {t('teamMembers')}
              </CardTitle>
              {teamMembers.length > 0 && (
                <Link href="/dashboard/teams">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    {t('viewAll')}
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {teamMembers.length === 0 ? (
                <div className="text-center py-6">
                  <Users className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">{t('noTeamMembers')}</p>
                  <Link href="/dashboard/teams">
                    <Button variant="outline" size="sm">
                      {t('inviteTeam')}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map((member: any) => (
                    <div key={member.id} className="flex items-center gap-3">
                      {member.user?.image ? (
                        <Image
                          src={member.user.image}
                          alt={member.user.name || 'User'}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {member.user?.name?.[0]?.toUpperCase() || member.user?.email[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.user?.name || 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Collections */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-5 w-5 text-primary" />
                {t('topCollections')}
              </CardTitle>
              {collections.length > 0 && (
                <Link href="/dashboard/collections">
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    {t('viewAll')}
                  </Button>
                </Link>
              )}
            </CardHeader>
            <CardContent>
              {collections.length === 0 ? (
                <div className="text-center py-6">
                  <Database className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">{t('noCollections')}</p>
                  <Link href="/dashboard/collections">
                    <Button variant="outline" size="sm">
                      {t('createCollection')}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {collections.slice(0, 4).map((collection: any) => (
                    <div key={collection.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Database className="h-4 w-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{collection.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {collection.documentCount || 0} {t('documents').toLowerCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
