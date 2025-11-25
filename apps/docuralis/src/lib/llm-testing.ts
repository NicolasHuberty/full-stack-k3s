import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { Mistral } from '@mistralai/mistralai'

interface TestConnectionParams {
    name: string
    baseUrl?: string | null
    apiKey: string
}

interface TestConnectionResult {
    success: boolean
    message: string
}

export async function testProviderConnection({
    name,
    baseUrl,
    apiKey,
}: TestConnectionParams): Promise<TestConnectionResult> {
    let message = ''
    const testPrompt = 'Hello, are you there?'

    try {
        if (name.toLowerCase() === 'openai') {
            // If it's the official OpenAI API, let the SDK use its default to avoid URL malformation
            const isOfficial = baseUrl?.includes('api.openai.com')

            const openai = new OpenAI({
                apiKey,
                baseURL: isOfficial ? undefined : baseUrl || undefined,
            })
            const completion = await openai.chat.completions.create({
                messages: [{ role: 'user', content: testPrompt }],
                model: 'gpt-3.5-turbo', // Use a cheap/standard model for testing
                max_tokens: 10,
            })
            message = completion.choices[0].message.content || 'No response content'
        } else if (name.toLowerCase() === 'anthropic') {
            // If it's the official Anthropic API, let the SDK use its default
            const isOfficial = baseUrl?.includes('api.anthropic.com')

            const anthropic = new Anthropic({
                apiKey,
                baseURL: isOfficial ? undefined : baseUrl || undefined,
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
            name.toLowerCase() === 'mistral' ||
            name.toLowerCase() === 'voxtral'
        ) {
            // Handle Mistral / Voxtral
            let serverUrl = baseUrl

            // If it's a custom URL that looks like OpenAI (e.g. vLLM) and NOT mistral.ai, use OpenAI SDK
            // unless user explicitly wants Mistral SDK.
            if (serverUrl && !serverUrl.includes('mistral.ai')) {
                // Assume OpenAI compatible for custom endpoints
                const openai = new OpenAI({
                    apiKey,
                    baseURL: serverUrl,
                })

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
            throw new Error(`Provider ${name} testing not implemented yet`)
        }

        return {
            success: true,
            message: `Success! Response: "${message.substring(0, 50)}..."`,
        }
    } catch (error: unknown) {
        console.error('Test connection failed:', error)
        const errorMessage = (error as Error).message || 'Unknown error occurred'
        throw new Error(errorMessage)
    }
}
