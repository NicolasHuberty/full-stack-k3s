import { prisma } from '@/lib/prisma'

export interface DefaultModelConfig {
    name: string
    provider: string
    apiKey?: string | null
}

/**
 * Retrieves the system default chat model.
 * If no default is set in the DB, falls back to a safe default (gpt-4o-mini).
 */
export async function getSystemDefaultModel(): Promise<DefaultModelConfig> {
    try {
        const defaultModel = await prisma.lLMModel.findFirst({
            where: {
                isDefault: true,
                isActive: true,
            },
            include: {
                provider: true,
            },
        }) as any // Prisma type inference issue with provider relation

        if (defaultModel && defaultModel.provider) {
            return {
                name: defaultModel.name,
                provider: defaultModel.provider.name.toLowerCase(),
                apiKey: defaultModel.provider.apiKey,
            }
        }
    } catch (error) {
        console.warn('Failed to fetch default model from DB, using fallback:', error)
    }

    // Fallback if no default set or DB error
    return {
        name: 'gpt-4o-mini',
        provider: 'openai',
    }
}
