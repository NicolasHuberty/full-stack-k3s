import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { testProviderConnection } from '@/lib/llm-testing'
import { isEncryptionConfigured } from '@/lib/encryption'

export async function POST(request: NextRequest) {
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

        const body = await request.json()
        const { name, baseUrl, apiKey } = body

        if (!name) {
            return NextResponse.json(
                { error: 'Provider name is required' },
                { status: 400 }
            )
        }

        // If apiKey is provided, check if encryption is configured (just as a warning/check, though we don't save it here)
        // Actually, for testing, we don't need to encrypt it, we just use it.
        // But if they plan to save it later, they'll need encryption.
        // Let's just proceed with testing.

        if (!apiKey) {
            return NextResponse.json(
                { error: 'API Key is required for testing' },
                { status: 400 }
            )
        }

        const result = await testProviderConnection({
            name,
            baseUrl,
            apiKey,
        })

        return NextResponse.json(result)
    } catch (error: unknown) {
        console.error('Test connection failed:', error)
        const errorMessage = (error as Error).message || 'Unknown error occurred'
        return NextResponse.json(
            { error: `Connection failed: ${errorMessage}` },
            { status: 500 }
        )
    }
}
