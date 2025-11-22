import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const providerUpdateSchema = z.object({
    displayName: z.string().min(1).optional(),
    baseUrl: z.union([z.string().url(), z.literal('')]).optional(),
    apiKey: z.string().optional(),
    description: z.string().optional(),
    logoUrl: z.union([z.string().url(), z.literal('')]).optional(),
    isActive: z.boolean().optional(),
})

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
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

        const provider = await prisma.lLMProvider.findUnique({
            where: { id },
            include: {
                models: {
                    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
                },
            },
        })

        if (!provider) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 })
        }

        return NextResponse.json({
            ...provider,
            apiKey: provider.apiKey ? '***' : null,
        })
    } catch (error) {
        console.error('Failed to get provider:', error)
        return NextResponse.json(
            { error: 'Failed to get provider' },
            { status: 500 }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
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
        const data = providerUpdateSchema.parse(body)

        // TODO: Encrypt API key before storing if provided

        const provider = await prisma.lLMProvider.update({
            where: { id },
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

        console.error('Failed to update provider:', error)
        return NextResponse.json(
            { error: 'Failed to update provider' },
            { status: 500 }
        )
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
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

        await prisma.lLMProvider.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete provider:', error)
        return NextResponse.json(
            { error: 'Failed to delete provider' },
            { status: 500 }
        )
    }
}
