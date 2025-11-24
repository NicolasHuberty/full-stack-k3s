import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { Mistral } from '@mistralai/mistralai'
import { decrypt } from '@/lib/encryption'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is system admin
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { isSystemAdmin: true },
    })

    if (!user?.isSystemAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const provider = await prisma.lLMProvider.findUnique({
      where: { id },
    })

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
    }

    const apiKey =
      decrypt(provider.apiKey || '') ||
      process.env[`${provider.name.toUpperCase()}_API_KEY`]

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API Key not found for this provider' },
        { status: 400 }
      )
    }

    let models: string[] = []

    if (provider.name.toLowerCase() === 'openai') {
      const openai = new OpenAI({ apiKey })
      const list = await openai.models.list()
      models = list.data
        .filter(
          (m) =>
            m.id.includes('gpt') ||
            m.id.includes('whisper') ||
            m.id.includes('o1-')
        )
        .map((m) => m.id)
        .sort()
    } else if (provider.name.toLowerCase() === 'anthropic') {
      try {
        const anthropic = new Anthropic({ apiKey })
        const list = await anthropic.models.list()
        models = list.data.map((m) => m.id).sort()
      } catch (e) {
        console.warn('Failed to fetch Anthropic models via API', e)
        return NextResponse.json(
          {
            error:
              'Failed to fetch models from Anthropic. Please ensure your API key has the correct permissions.',
          },
          { status: 400 }
        )
      }
    } else if (
      provider.name.toLowerCase() === 'mistral' ||
      provider.name.toLowerCase() === 'voxtral'
    ) {
      try {
        const mistral = new Mistral({ apiKey })
        const list = await mistral.models.list()
        // Deduplicate models using Set
        if (list.data) {
          models = [...new Set(list.data.map((m) => m.id))].sort()
        }
      } catch (e) {
        console.warn('Failed to fetch Mistral models via API', e)
        return NextResponse.json(
          {
            error:
              'Failed to fetch models from Mistral. Please check your API key.',
          },
          { status: 400 }
        )
      }
    } else {
      // For other providers, we might not support auto-fetch yet
      return NextResponse.json({ models: [] })
    }

    return NextResponse.json({ models })
  } catch (error) {
    console.error('Failed to fetch provider models:', error)
    return NextResponse.json(
      { error: 'Failed to fetch models from provider' },
      { status: 500 }
    )
  }
}
