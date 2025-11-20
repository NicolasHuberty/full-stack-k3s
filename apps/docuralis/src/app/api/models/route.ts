import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(_request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get only active models for regular users
    const models = await prisma.lLMModel.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { provider: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        displayName: true,
        provider: true,
        contextWindow: true,
        maxTokens: true,
        isDefault: true,
      },
    })

    return NextResponse.json(models)
  } catch (error) {
    console.error('Failed to get models:', error)
    return NextResponse.json({ error: 'Failed to get models' }, { status: 500 })
  }
}
