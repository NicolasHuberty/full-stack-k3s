import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding LLM providers...')

    // Create providers
    const providers = [
        {
            name: 'openai',
            displayName: 'OpenAI',
            description: 'OpenAI provides state-of-the-art language models including GPT-4 and GPT-3.5',
            baseUrl: 'https://api.openai.com/v1',
            isActive: true,
        },
        {
            name: 'anthropic',
            displayName: 'Anthropic',
            description: 'Anthropic develops Claude, a helpful, harmless, and honest AI assistant',
            baseUrl: 'https://api.anthropic.com/v1',
            isActive: true,
        },
        {
            name: 'groq',
            displayName: 'Groq - SDK not ready',
            description: 'Groq provides ultra-fast inference for open-source models',
            baseUrl: 'https://api.groq.com/openai/v1',
            isActive: false,
        },
        {
            name: 'mistral',
            displayName: 'Mistral AI - SDK not ready',
            description: 'Mistral AI offers powerful open-source and commercial language models',
            baseUrl: 'https://api.mistral.ai/v1',
            isActive: false,
        },
    ]

    for (const providerData of providers) {
        const provider = await prisma.lLMProvider.upsert({
            where: { name: providerData.name },
            update: providerData,
            create: providerData,
        })
        console.log(`✓ Created/updated provider: ${provider.displayName}`)
    }

    console.log('✓ Seeding completed!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
