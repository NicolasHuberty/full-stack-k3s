import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const modelSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  contextWindow: z.number().optional(),
  maxTokens: z.number().optional(),
  inputPrice: z.number().optional(),
  outputPrice: z.number().optional(),
  isActive: z.boolean().optional(),
  isDefault: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
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
    const body = await request.json()
    const data = modelSchema.parse(body)

    // If setting as default, unset other defaults
    if (data.isDefault) {
      await prisma.lLMModel.updateMany({
        where: { isDefault: true, NOT: { id } },
        data: { isDefault: false },
      })
    }

    const model = await prisma.lLMModel.update({
      where: { id },
      data,
    })

    return NextResponse.json(model)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update model:', error)
    return NextResponse.json(
      { error: 'Failed to update model' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
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

    await prisma.lLMModel.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete model:', error)
    return NextResponse.json(
      { error: 'Failed to delete model' },
      { status: 500 }
    )
  }
}
