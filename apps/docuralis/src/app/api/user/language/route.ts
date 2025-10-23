import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const languageSchema = z.object({
  language: z.string().min(2).max(5),
})

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = languageSchema.parse(body)

    await prisma.user.update({
      where: { id: session.user.id },
      data: { language: validatedData.language },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to update language:', error)
    return NextResponse.json(
      { error: 'Failed to update language' },
      { status: 500 }
    )
  }
}
