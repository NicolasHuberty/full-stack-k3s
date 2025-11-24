import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { Mistral } from '@mistralai/mistralai'
import { decrypt } from '@/lib/encryption'

export async function POST(
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
        {
          error:
            'API Key not found. Please configure it in settings or env vars.',
        },
        { status: 400 }
      )
    }

    let message = ''
    const testPrompt = 'Hello, are you there?'

    if (provider.name.toLowerCase() === 'openai') {
      // If it's the official OpenAI API, let the SDK use its default to avoid URL malformation
      const isOfficial = provider.baseUrl?.includes('api.openai.com')

      const openai = new OpenAI({
        apiKey,
        baseURL: isOfficial ? undefined : provider.baseUrl || undefined,
      })
      const completion = await openai.chat.completions.create({
        messages: [{ role: 'user', content: testPrompt }],
        model: 'gpt-3.5-turbo', // Use a cheap/standard model for testing
        max_tokens: 10,
      })
      message = completion.choices[0].message.content || 'No response content'
    } else if (provider.name.toLowerCase() === 'anthropic') {
      // If it's the official Anthropic API, let the SDK use its default
      const isOfficial = provider.baseUrl?.includes('api.anthropic.com')

      const anthropic = new Anthropic({
        apiKey,
        baseURL: isOfficial ? undefined : provider.baseUrl || undefined,
      })
      const completion = await anthropic.messages.create({
        model: 'claude-3-haiku-20240307', // Use a fast model
        max_tokens: 10,
        messages: [{ role: 'user', content: testPrompt }],
      })
      // Anthropic response content is an array of blocks
      if (
        completion.content.length > 0 &&
        completion.content[0].type === 'text'
      ) {
        message = completion.content[0].text
      } else {
        message = 'No text response received'
      }
    } else if (
      provider.name.toLowerCase() === 'mistral' ||
      provider.name.toLowerCase() === 'voxtral'
    ) {
      // Handle Mistral / Voxtral
      let serverUrl = provider.baseUrl

      // If it's a custom URL that looks like OpenAI (e.g. vLLM) and NOT mistral.ai, use OpenAI SDK
      // unless user explicitly wants Mistral SDK.
      // For simplicity and consistency with STT service, let's try to infer.

      if (serverUrl && !serverUrl.includes('mistral.ai')) {
        // Assume OpenAI compatible for custom endpoints
        const openai = new OpenAI({
          apiKey,
          baseURL: serverUrl,
        })
        // We need a model name. Try to list models or use a generic one?
        // Using 'mistral-tiny' or 'gpt-3.5-turbo' might fail if model doesn't exist.
        // Let's try to list models first to pick one, or use a safe default if we can't.
        // For a generic test, 'gpt-3.5-turbo' is risky on non-OpenAI servers if they validate model names strictly.
        // But often they alias it. Let's try to fetch models first? No, that's too slow.
        // Let's try a generic name often used in local setups or just 'test'.
        // Actually, for Voxtral/Mistral, 'mistral-tiny' or 'mistral-small' is a safer bet.

        const completion = await openai.chat.completions.create({
          messages: [{ role: 'user', content: testPrompt }],
          model: 'mistral-tiny', // Hope this works or is ignored by custom server
          max_tokens: 10,
        })
        message = completion.choices[0].message.content || 'No response content'
      } else {
        // Official Mistral API
        if (serverUrl && serverUrl.endsWith('/v1'))
          serverUrl = serverUrl.slice(0, -3)
        if (serverUrl && serverUrl.endsWith('/v1/'))
          serverUrl = serverUrl.slice(0, -4)

        const client = new Mistral({
          apiKey,
          serverURL: serverUrl || undefined,
        })

        const completion = await client.chat.complete({
          model: 'mistral-tiny',
          messages: [{ role: 'user', content: testPrompt }],
          maxTokens: 10,
        })
        // @ts-expect-error - SDK types may not match exactly
        message = completion.choices[0].message.content || 'No response content'
      }
    } else {
      return NextResponse.json(
        { error: `Provider ${provider.name} testing not implemented yet` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Success! Response: "${message.substring(0, 50)}..."`,
    })
  } catch (error: unknown) {
    console.error('Test connection failed:', error)
    // Return a readable error message
    const errorMessage = (error as Error).message || 'Unknown error occurred'
    return NextResponse.json(
      { error: `Connection failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
