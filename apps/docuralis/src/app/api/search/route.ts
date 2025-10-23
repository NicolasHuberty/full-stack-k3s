import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getRAGService } from '@/lib/rag/service'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  collectionId: z.string(),
  limit: z.number().min(1).max(50).optional(),
  documentId: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = searchSchema.parse(body)

    const ragService = getRAGService()
    const results = await ragService.search(validatedData, session.user.id)

    return NextResponse.json(results)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Search failed:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
