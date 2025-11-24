import OpenAI from 'openai'
import { Mistral } from '@mistralai/mistralai'
import { prisma } from '@/lib/prisma'
import { ModelType } from '@prisma/client'
import { decrypt } from '@/lib/encryption'

export interface STTAdapter {
  transcribe(audioFile: File, language?: string): Promise<string>
}

export class OpenAIWhisperAdapter implements STTAdapter {
  private client: OpenAI

  constructor(
    apiKey: string,
    private modelName: string
  ) {
    this.client = new OpenAI({ apiKey })
  }

  async transcribe(audioFile: File, language?: string): Promise<string> {
    try {
      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: this.modelName,
        language: language,
      })
      return response.text
    } catch (error) {
      console.error('OpenAI Whisper transcription failed:', error)
      throw new Error('Transcription failed')
    }
  }
}

export class VoxtralAdapter implements STTAdapter {
  private client: Mistral | OpenAI
  private isMistralSdk: boolean

  constructor(
    apiKey: string,
    private modelName: string,
    private baseUrl?: string | null
  ) {
    // If Base URL is the official Mistral API or not provided, use Mistral SDK
    // If it's a custom URL that looks like OpenAI (e.g. vLLM), we might want OpenAI SDK,
    // but let's try Mistral SDK first as it allows custom serverURL.

    // However, if the user specifically wants OpenAI compatibility for "Voxtral" (e.g. local server),
    // they might need the OpenAI client.
    // But the user asked to check Mistral docs, so let's prioritize Mistral SDK.

    if (baseUrl && !baseUrl.includes('mistral.ai')) {
      // Heuristic: if URL is NOT mistral.ai, assume it might be a generic OpenAI-compatible server
      // unless the user explicitly selected 'mistral' provider which implies Mistral SDK.
      // But 'voxtral' usually implies Mistral models.
      // Let's stick to the previous logic: if it's 'mistral' provider, use Mistral SDK.
      // But wait, the previous logic was "if baseUrl, use OpenAI".

      // Let's refine: Use Mistral SDK if it's the official API.
      // Use OpenAI SDK if it's a custom endpoint (often OpenAI compatible).
      this.client = new OpenAI({
        apiKey,
        baseURL: baseUrl,
      })
      this.isMistralSdk = false
    } else {
      // Official Mistral API
      // The SDK appends '/v1' automatically, so we must strip it if present in the DB config
      let serverUrl = baseUrl
      if (serverUrl && serverUrl.endsWith('/v1')) {
        serverUrl = serverUrl.slice(0, -3)
      }
      // If it ends with /v1/ (trailing slash), strip that too
      if (serverUrl && serverUrl.endsWith('/v1/')) {
        serverUrl = serverUrl.slice(0, -4)
      }

      this.client = new Mistral({
        apiKey,
        serverURL: serverUrl || undefined,
      })
      this.isMistralSdk = true
    }
  }

  async transcribe(audioFile: File, language?: string): Promise<string> {
    try {
      if (this.isMistralSdk) {
        const client = this.client as Mistral
        // Mistral SDK expects 'file' as a File/Blob or similar.
        // The method is likely client.audio.transcriptions.create or complete.
        // Based on docs (Python uses complete), JS likely uses 'create' or 'complete'.
        // Let's try 'create' as it's standard, but catch error if it fails.

        // Note: The Mistral JS SDK signature might need the file content as a specific type.
        // We'll pass the File object directly first.
        const response = await client.audio.transcriptions.complete({
          file: audioFile,
          model: this.modelName,
          language: language,
        })
        return response.text
      } else {
        const client = this.client as OpenAI
        const response = await client.audio.transcriptions.create({
          file: audioFile,
          model: this.modelName,
          language: language,
        })
        return response.text
      }
    } catch (error) {
      console.error('Voxtral/Mistral transcription failed:', error)
      throw error
    }
  }
}

export class STTService {
  static async createClient(): Promise<STTAdapter> {
    // 1. Try to find a default STT model
    const defaultModel = await prisma.lLMModel.findFirst({
      where: {
        type: ModelType.STT,
        isDefault: true,
        isActive: true,
      },
      include: {
        provider: true,
      },
    })

    if (defaultModel && defaultModel.provider) {
      const apiKey =
        decrypt(defaultModel.provider.apiKey || '') ||
        process.env[`${defaultModel.provider.name.toUpperCase()}_API_KEY`]

      if (!apiKey) {
        throw new Error(
          `API key not found for provider ${defaultModel.provider.name}`
        )
      }

      const baseUrl = defaultModel.provider.baseUrl

      switch (defaultModel.provider.name.toLowerCase()) {
        case 'openai':
          return new OpenAIWhisperAdapter(apiKey, defaultModel.name)
        case 'voxtral':
        case 'mistral':
          return new VoxtralAdapter(apiKey, defaultModel.name, baseUrl)
        default:
          throw new Error(
            `Unsupported STT provider: ${defaultModel.provider.name}`
          )
      }
    }

    // 2. Fallback: Check if OpenAI provider is active and use it with default whisper-1
    const openAIProvider = await prisma.lLMProvider.findUnique({
      where: { name: 'openai' },
    })

    if (openAIProvider && openAIProvider.isActive) {
      const apiKey =
        decrypt(openAIProvider.apiKey || '') || process.env.OPENAI_API_KEY
      if (apiKey) {
        return new OpenAIWhisperAdapter(apiKey, 'whisper-1')
      }
    }

    throw new Error('No active STT configuration found')
  }
}
