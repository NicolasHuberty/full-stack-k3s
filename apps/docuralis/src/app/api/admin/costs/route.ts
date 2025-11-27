import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { isSystemAdmin: true },
    })

    if (!user?.isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse query params
    const searchParams = request.nextUrl.searchParams
    const startDateParam = searchParams.get('startDate')
    const endDateParam = searchParams.get('endDate')
    const providerIdParam = searchParams.get('providerId')
    const modelParam = searchParams.get('model')
    const userIdParam = searchParams.get('userId')
    const organizationIdParam = searchParams.get('organizationId')

    const metaParam = searchParams.get('meta')

    if (metaParam === 'true') {
      const [providers, models, users, organizations] = await Promise.all([
        prisma.lLMProvider.findMany({
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
        prisma.lLMModel.findMany({
          select: { name: true, providerId: true },
          orderBy: { name: 'asc' },
        }),
        prisma.user.findMany({
          select: { id: true, name: true, email: true },
          orderBy: { name: 'asc' },
        }),
        prisma.organization.findMany({
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        }),
      ])

      return NextResponse.json({
        providers,
        models,
        users,
        organizations,
      })
    }

    const dateFilter: Record<string, Date> = {}
    if (startDateParam) {
      dateFilter.gte = new Date(startDateParam)
    }
    if (endDateParam) {
      // Set to end of day if only date is provided, or just use as is
      const endDate = new Date(endDateParam)
      endDate.setHours(23, 59, 59, 999)
      dateFilter.lte = endDate
    }

    // 1. Fetch all models to get pricing and for provider filtering
    const models = await prisma.lLMModel.findMany({
      select: {
        name: true,
        inputPrice: true,
        outputPrice: true,
        providerId: true,
      },
    })

    const priceMap = new Map(
      models.map((m) => [
        m.name,
        { input: m.inputPrice || 0, output: m.outputPrice || 0 },
      ])
    )

    // Build filters
    const andConditions: Prisma.ChatMessageWhereInput[] = [
      {
        OR: [
          { promptTokens: { not: null } },
          { completionTokens: { not: null } },
        ],
      },
    ]

    if (Object.keys(dateFilter).length > 0) {
      andConditions.push({ createdAt: dateFilter })
    }

    if (modelParam) {
      andConditions.push({ modelUsed: modelParam })
    }

    if (providerIdParam) {
      // Filter models that belong to this provider
      const providerModels = models
        .filter((m) => m.providerId === providerIdParam)
        .map((m) => m.name)

      if (providerModels.length > 0) {
        andConditions.push({ modelUsed: { in: providerModels } })
      } else {
        // If provider has no models, no messages should match
        andConditions.push({ modelUsed: '___NO_MATCH___' })
      }
    }

    if (userIdParam) {
      andConditions.push({ session: { userId: userIdParam } })
    }

    if (organizationIdParam) {
      andConditions.push({
        session: { collection: { organizationId: organizationIdParam } },
      })
    }

    const whereClause: Prisma.ChatMessageWhereInput = {
      AND: andConditions,
    }

    // 2. Fetch all messages with token usage
    const messages = await prisma.chatMessage.findMany({
      where: whereClause,
      select: {
        promptTokens: true,
        completionTokens: true,
        modelUsed: true,
        createdAt: true,
        session: {
          select: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
              },
            },
            collection: {
              select: {
                organization: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    // 3. Aggregate Data
    const byUser = new Map<
      string,
      {
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
    >()

    const byOrg = new Map<
      string,
      {
        organization: { id: string; name: string }
        totalTokens: number
        totalCost: number
        messageCount: number
      }
    >()

    const byModel = new Map<
      string,
      {
        model: string
        totalTokens: number
        totalCost: number
        messageCount: number
      }
    >()

    const dailyCosts = new Map<string, number>()
    const dailyCostsByProvider = new Map<string, Map<string, number>>()
    const missingPriceModels = new Set<string>()

    for (const msg of messages) {
      const promptTokens = msg.promptTokens || 0
      const completionTokens = msg.completionTokens || 0
      const totalTokens = promptTokens + completionTokens
      const modelName = msg.modelUsed

      let cost = 0
      let modelProviderId = ''
      if (modelName) {
        const prices = priceMap.get(modelName)
        if (prices) {
          // Assume price is per 1M tokens
          cost =
            (promptTokens * prices.input + completionTokens * prices.output) /
            1_000_000

          // Get provider ID for this model
          const modelInfo = models.find((m) => m.name === modelName)
          if (modelInfo) {
            modelProviderId = modelInfo.providerId
          }
        } else {
          missingPriceModels.add(modelName)
        }

        // Aggregate by Model
        const currentModelStats = byModel.get(modelName) || {
          model: modelName,
          totalTokens: 0,
          totalCost: 0,
          messageCount: 0,
        }
        currentModelStats.totalTokens += totalTokens
        currentModelStats.totalCost += cost
        currentModelStats.messageCount += 1
        byModel.set(modelName, currentModelStats)
      }

      // Aggregate by User
      const userId = msg.session.user.id
      if (!byUser.has(userId)) {
        byUser.set(userId, {
          user: msg.session.user,
          totalTokens: 0,
          totalCost: 0,
          messageCount: 0,
        })
      }
      const userStats = byUser.get(userId)!
      userStats.totalTokens += totalTokens
      userStats.totalCost += cost
      userStats.messageCount += 1

      // Aggregate by Organization
      const org = msg.session.collection?.organization
      if (org) {
        if (!byOrg.has(org.id)) {
          byOrg.set(org.id, {
            organization: org,
            totalTokens: 0,
            totalCost: 0,
            messageCount: 0,
          })
        }
        const orgStats = byOrg.get(org.id)!
        orgStats.totalTokens += totalTokens
        orgStats.totalCost += cost
        orgStats.messageCount += 1
      }

      // Aggregate for Chart (Daily)
      const dateKey = msg.createdAt.toISOString().split('T')[0] // YYYY-MM-DD
      const currentDailyCost = dailyCosts.get(dateKey) || 0
      dailyCosts.set(dateKey, currentDailyCost + cost)

      // Aggregate for Chart by Provider
      if (modelProviderId) {
        if (!dailyCostsByProvider.has(dateKey)) {
          dailyCostsByProvider.set(dateKey, new Map())
        }
        const providerCosts = dailyCostsByProvider.get(dateKey)!
        const currentProviderCost = providerCosts.get(modelProviderId) || 0
        providerCosts.set(modelProviderId, currentProviderCost + cost)
      }
    }

    // Format Chart Data with provider breakdown
    const chartData = Array.from(dailyCosts.keys())
      .sort()
      .map((date) => {
        const dataPoint: Record<string, string | number> = {
          date,
          total: dailyCosts.get(date) || 0,
        }

        // Add provider-specific costs
        const providerCosts = dailyCostsByProvider.get(date)
        if (providerCosts) {
          providerCosts.forEach((cost, providerId) => {
            dataPoint[providerId] = cost
          })
        }

        return dataPoint
      })

    return NextResponse.json({
      byUser: Array.from(byUser.values()).sort(
        (a, b) => b.totalCost - a.totalCost
      ),
      byOrganization: Array.from(byOrg.values()).sort(
        (a, b) => b.totalCost - a.totalCost
      ),
      byModel: Array.from(byModel.values()).sort(
        (a, b) => b.totalCost - a.totalCost
      ),
      chartData,
      warnings: Array.from(missingPriceModels),
    })
  } catch (error) {
    console.error('Failed to fetch cost stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch cost statistics' },
      { status: 500 }
    )
  }
}
