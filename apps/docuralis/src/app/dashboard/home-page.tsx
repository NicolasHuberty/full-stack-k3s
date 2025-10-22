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
  ArrowRight,
  Sparkles,
  FileText,
  Activity,
  HardDrive,
  Zap,
  BarChart3,
  Clock,
  CheckCircle2,
  Plus,
  Send,
  Star,
  FolderOpen,
  CalendarDays
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatDistanceToNow, format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { formatBytes } from '@/lib/utils/format'

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
    storageLimit: 0,
    chatsThisWeek: 0,
    documentsThisWeek: 0
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

        // Calculate chats this week
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const chatsThisWeek = chatsData.sessions?.filter((chat: any) =>
          new Date(chat.createdAt) > weekAgo
        ).length || 0

        setStats(prev => ({
          ...prev,
          totalChats: chatsData.sessions?.length || 0,
          chatsThisWeek
        }))
      }

      // Fetch collections
      const collectionsRes = await fetch('/api/collections')
      if (collectionsRes.ok) {
        const collectionsData = await collectionsRes.json()
        setCollections(collectionsData.collections || [])

        const totalDocs = collectionsData.collections?.reduce((sum: number, c: any) =>
          sum + (c.documentCount || 0), 0) || 0

        setStats(prev => ({
          ...prev,
          totalCollections: collectionsData.collections?.length || 0,
          totalDocuments: totalDocs,
          storageUsed: collectionsData.collections?.reduce((sum: number, c: any) =>
            sum + parseInt(c.storageUsed || 0), 0) || 0
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

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return `🌅 ${t('goodMorning')}`
    if (hour < 18) return `☀️ ${t('goodAfternoon')}`
    return `🌙 ${t('goodEvening')}`
  }

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-background via-background to-muted/20">
      <div className="h-full p-4 md:p-6 max-w-[1800px] mx-auto flex flex-col gap-4">
        {/* Compact Header with Stats */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary/90 to-primary/80 p-6 text-primary-foreground shadow-lg flex-shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32 blur-3xl" />

          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-primary-foreground/80 text-sm font-medium">{getGreeting()}, {session?.user?.name?.split(' ')[0] || 'there'}</p>
                <p className="text-primary-foreground/90 text-sm mt-1">{t('dashboardSubtitle')}</p>
              </div>
              <Button
                onClick={handleCreateChat}
                size="sm"
                className="bg-white text-primary hover:bg-white/90 shadow-lg gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {t('newChat')}
              </Button>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  <div>
                    <p className="text-xl font-bold">{stats.totalChats}</p>
                    <p className="text-[10px] text-primary-foreground/70">{t('conversations')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4" />
                  <div>
                    <p className="text-xl font-bold">{stats.totalCollections}</p>
                    <p className="text-[10px] text-primary-foreground/70">{t('collections')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <div>
                    <p className="text-xl font-bold">{stats.totalDocuments}</p>
                    <p className="text-[10px] text-primary-foreground/70">{t('documents')}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <div>
                    <p className="text-xl font-bold">+{stats.chatsThisWeek}</p>
                    <p className="text-[10px] text-primary-foreground/70">This week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-4 overflow-y-auto pr-2">
            {/* Activity Overview */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>{t('recentActivity')}</CardTitle>
                      <CardDescription className="text-xs">Your latest conversations</CardDescription>
                    </div>
                  </div>
                  <Link href="/dashboard/chat">
                    <Button variant="ghost" size="sm" className="gap-1">
                      {t('viewAll')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {recentChats.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <MessageSquare className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{t('noRecentChats')}</h3>
                    <p className="text-muted-foreground text-sm mb-6">Start your AI journey today</p>
                    <Button onClick={handleCreateChat} className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      {t('startFirstChat')}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentChats.map((chat, idx) => (
                      <Link
                        key={chat.id}
                        href={`/dashboard/chat?session=${chat.id}`}
                        className="group flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-accent/50 transition-all"
                      >
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          idx === 0 ? 'bg-gradient-to-br from-blue-500 to-blue-600' :
                          idx === 1 ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                          idx === 2 ? 'bg-gradient-to-br from-green-500 to-green-600' :
                          'bg-gradient-to-br from-orange-500 to-orange-600'
                        } text-white`}>
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate group-hover:text-primary transition-colors">
                            {chat.title || t('untitledChat')}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Send className="h-3 w-3" />
                              {chat._count?.messages || 0} {t('messages')}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(chat.updatedAt), { addSuffix: true, locale: fr })}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-2 shadow-lg overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle>{t('quickActions')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Button
                    onClick={handleCreateChat}
                    variant="outline"
                    className="h-auto py-6 flex-col gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                      <MessageSquare className="h-6 w-6" />
                    </div>
                    <span className="font-semibold">{t('newChat')}</span>
                    <span className="text-xs text-muted-foreground">Start a conversation</span>
                  </Button>

                  <Link href="/dashboard/collections" className="block">
                    <Button
                      variant="outline"
                      className="w-full h-full py-6 flex-col gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                        <Database className="h-6 w-6" />
                      </div>
                      <span className="font-semibold">{t('manageCollections')}</span>
                      <span className="text-xs text-muted-foreground">Organize documents</span>
                    </Button>
                  </Link>

                  <Link href="/dashboard/teams" className="block">
                    <Button
                      variant="outline"
                      className="w-full h-full py-6 flex-col gap-3 border-2 hover:border-primary hover:bg-primary/5 transition-all group"
                    >
                      <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                        <Users className="h-6 w-6" />
                      </div>
                      <span className="font-semibold">{t('inviteTeam')}</span>
                      <span className="text-xs text-muted-foreground">Collaborate together</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-4 overflow-y-auto pr-2">
            {/* Storage Analytics */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                    <HardDrive className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{t('storage')}</CardTitle>
                    <CardDescription className="text-xs">
                      {formatBytes(stats.storageUsed)} of {formatBytes(stats.storageLimit)} used
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Usage</span>
                    <span className="text-muted-foreground">{Math.min(storagePercentage, 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        storagePercentage > 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                        storagePercentage > 70 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                        'bg-gradient-to-r from-green-500 to-green-600'
                      }`}
                      style={{ width: `${Math.min(storagePercentage, 100)}%` }}
                    />
                  </div>
                </div>

                {collections.length > 0 && (
                  <div className="space-y-2 pt-4 border-t">
                    <p className="text-sm font-medium mb-3">Storage by collection</p>
                    {collections.slice(0, 3).map((col: any) => {
                      const colStorage = parseInt(col.storageUsed || 0)
                      const colPercentage = stats.storageUsed > 0 ? (colStorage / stats.storageUsed) * 100 : 0
                      return (
                        <div key={col.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate max-w-[200px]">{col.name}</span>
                            <span className="text-muted-foreground">
                              {formatBytes(colStorage)} ({colPercentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${colPercentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Team Members */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <CardTitle className="text-base">{t('teamMembers')}</CardTitle>
                  </div>
                  {teamMembers.length > 0 && (
                    <Link href="/dashboard/teams">
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                        {t('viewAll')}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Users className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{t('noTeamMembers')}</p>
                    <Link href="/dashboard/teams">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-3 w-3" />
                        {t('inviteTeam')}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {teamMembers.map((member: any) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                        {member.user?.image ? (
                          <Image
                            src={member.user.image}
                            alt={member.user.name || 'User'}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-full object-cover ring-2 ring-background"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center ring-2 ring-background">
                            <span className="text-sm font-semibold text-primary-foreground">
                              {member.user?.name?.[0]?.toUpperCase() || member.user?.email[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.user?.name || 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{member.role.toLowerCase()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Collections */}
            <Card className="border-2 shadow-lg">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <FolderOpen className="h-5 w-5 text-purple-500" />
                    </div>
                    <CardTitle className="text-base">{t('topCollections')}</CardTitle>
                  </div>
                  {collections.length > 0 && (
                    <Link href="/dashboard/collections">
                      <Button variant="ghost" size="sm" className="h-8 text-xs gap-1">
                        {t('viewAll')}
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {collections.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Database className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{t('noCollections')}</p>
                    <Link href="/dashboard/collections">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Plus className="h-3 w-3" />
                        {t('createCollection')}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collections.slice(0, 4).map((collection: any, idx: number) => (
                      <Link
                        key={collection.id}
                        href={`/dashboard/collections/${collection.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          idx === 0 ? 'bg-gradient-to-br from-purple-500 to-purple-600' :
                          idx === 1 ? 'bg-gradient-to-br from-pink-500 to-pink-600' :
                          idx === 2 ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
                          'bg-gradient-to-br from-cyan-500 to-cyan-600'
                        } text-white`}>
                          <Database className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {collection.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {collection.documentCount || 0} {t('documents').toLowerCase()}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
