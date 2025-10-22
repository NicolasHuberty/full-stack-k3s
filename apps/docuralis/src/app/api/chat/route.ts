import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRAGService } from '@/lib/rag/service'
import { z } from 'zod'

const chatSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  collectionId: z.string().optional(),
  sessionId: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().min(1).max(4000).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = chatSchema.parse(body)

    const ragService = getRAGService()
    const response = await ragService.chat({
      ...validatedData,
      userId: session.user.id,
    })

    return NextResponse.json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Chat failed:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
