import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

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

        const apiKey = provider.apiKey || process.env[`${provider.name.toUpperCase()}_API_KEY`]

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
                .filter((m) => m.id.includes('gpt')) // Filter for GPT models to avoid clutter
                .map((m) => m.id)
                .sort()
        } else if (provider.name.toLowerCase() === 'anthropic') {
            // Anthropic doesn't have a public list models API in the SDK yet in the same way, 
            // but we can try to list them if available or return a static list of known recent models 
            // if the SDK doesn't support it.
            // Actually, Anthropic DOES have a models.list() endpoint now in newer SDKs/API versions,
            // but let's check if it's available or fallback to a hardcoded list of popular ones if it fails,
            // as it's safer. 
            // Wait, checking documentation... Anthropic API `GET /v1/models` exists.

            try {
                const anthropic = new Anthropic({ apiKey })
                const list = await anthropic.models.list()
                models = list.data.map((m) => m.id).sort()
            } catch (e) {
                console.warn('Failed to fetch Anthropic models via API, falling back to static list', e)
                // Fallback list if API fails (e.g. old SDK or permission issue)
                models = [
                    'claude-3-5-sonnet-20241022',
                    'claude-3-5-haiku-20241022',
                    'claude-3-opus-20240229',
                    'claude-3-sonnet-20240229',
                    'claude-3-haiku-20240307',
                ]
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
