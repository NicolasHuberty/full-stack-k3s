import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { encrypt, isEncryptionConfigured } from '@/lib/encryption'

const providerSchema = z.object({
    name: z.string().min(1),
    displayName: z.string().min(1),
    baseUrl: z.union([z.string().url(), z.literal('')]).optional(),
    apiKey: z.string().optional(),
    description: z.string().optional(),
    logoUrl: z.union([z.string().url(), z.literal('')]).optional(),
    isActive: z.boolean().default(true),
})

export async function GET(_request: NextRequest) {
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

        const providers = await prisma.lLMProvider.findMany({
            include: {
                _count: {
                    select: { models: true },
                },
            },
            orderBy: { displayName: 'asc' },
        })

        // Don't expose API keys in the response
        const providersWithoutKeys = providers.map((p) => ({
            ...p,
            apiKey: p.apiKey ? '***' : null,
            modelCount: p._count.models,
        }))

        return NextResponse.json(providersWithoutKeys)
    } catch (error) {
        console.error('Failed to get providers:', error)
        return NextResponse.json(
            { error: 'Failed to get providers' },
            { status: 500 }
        )
    }
}

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
        const data = providerSchema.parse(body)

        // Check if encryption is configured when API key is provided
        if (data.apiKey && !isEncryptionConfigured()) {
            console.error(
                'Attempted to save provider with API key but encryption is not configured'
            )
            return NextResponse.json(
                {
                    error:
                        'Server configuration error: Encryption is not properly configured. Please contact your system administrator.',
                },
                { status: 500 }
            )
        }

        // Encrypt API key before storing
        if (data.apiKey) {
            try {
                data.apiKey = encrypt(data.apiKey)
            } catch (encryptError) {
                console.error('Failed to encrypt API key:', encryptError)
                return NextResponse.json(
                    {
                        error:
                            'Failed to encrypt API key. Please check server configuration.',
                    },
                    { status: 500 }
                )
            }
        }

        const provider = await prisma.lLMProvider.create({
            data,
        })

        return NextResponse.json({
            ...provider,
            apiKey: provider.apiKey ? '***' : null,
        })
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                { error: 'Validation failed', details: error.issues },
                { status: 400 }
            )
        }

        // Handle unique constraint violation (duplicate name)
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            (error as any).code === 'P2002'
        ) {
            return NextResponse.json(
                { error: 'A provider with this name already exists' },
                { status: 409 }
            )
        }

        console.error('Failed to create provider:', error)
        // Log the full error for debugging
        if (error instanceof Error) {
            console.error('Error details:', {
                message: error.message,
                stack: error.stack,
            })
        }
        return NextResponse.json(
            { error: 'Failed to create provider' },
            { status: 500 }
        )
    }
}
