import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {

  const models = [
    {
      name: 'gpt-4o',
      displayName: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128000,
      maxTokens: 16384,
      inputPrice: 2.5,
      outputPrice: 10.0,
      isActive: true,
      isDefault: false,
    },
    {
      name: 'gpt-4o-mini',
      displayName: 'GPT-4o Mini',
      provider: 'openai',
      contextWindow: 128000,
      maxTokens: 16384,
      inputPrice: 0.15,
      outputPrice: 0.6,
      isActive: true,
      isDefault: true,
    },
    {
      name: 'gpt-4-turbo',
      displayName: 'GPT-4 Turbo',
      provider: 'openai',
      contextWindow: 128000,
      maxTokens: 4096,
      inputPrice: 10.0,
      outputPrice: 30.0,
      isActive: true,
      isDefault: false,
    },
    {
      name: 'gpt-3.5-turbo',
      displayName: 'GPT-3.5 Turbo',
      provider: 'openai',
      contextWindow: 16385,
      maxTokens: 4096,
      inputPrice: 0.5,
      outputPrice: 1.5,
      isActive: true,
      isDefault: false,
    },
    {
      name: 'claude-3-5-sonnet-20241022',
      displayName: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextWindow: 200000,
      maxTokens: 8192,
      inputPrice: 3.0,
      outputPrice: 15.0,
      isActive: true,
      isDefault: false,
    },
    {
      name: 'claude-3-opus-20240229',
      displayName: 'Claude 3 Opus',
      provider: 'anthropic',
      contextWindow: 200000,
      maxTokens: 4096,
      inputPrice: 15.0,
      outputPrice: 75.0,
      isActive: true,
      isDefault: false,
    },
  ]

  for (const model of models) {
    await prisma.lLMModel.upsert({
      where: { name: model.name },
      update: model,
      create: model,
    })
  }

}

main()
  .catch((e) => {
    console.error('Error seeding LLM models:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
