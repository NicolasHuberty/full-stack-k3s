import { prisma } from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { LLMModel, LLMProvider } from '@prisma/client'

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
    const defaultModel = (await prisma.lLMModel.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
      include: {
        provider: true,
      },
    })) as (LLMModel & { provider: LLMProvider }) | null

    if (defaultModel && defaultModel.provider) {
      return {
        name: defaultModel.name,
        provider: defaultModel.provider.name.toLowerCase(),
        apiKey: decrypt(defaultModel.provider.apiKey || ''),
      }
    }
  } catch (error) {
    console.warn(
      'Failed to fetch default model from DB, using fallback:',
      error
    )
  }

  // Fallback if no default set or DB error
  return {
    name: 'gpt-4o-mini',
    provider: 'openai',
  }
}
