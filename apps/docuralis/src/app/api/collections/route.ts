import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createCollection } from '@/lib/collections/service'
import { getUserCollections } from '@/lib/collections/permissions'
import { z } from 'zod'

const createCollectionSchema = z.object({
  name: z.string().min(1, 'Collection name is required'),
  description: z.string().optional(),
  visibility: z.enum(['PRIVATE', 'ORGANIZATION', 'PUBLIC']).optional(),
  allowPublicRead: z.boolean().optional(),
  organizationId: z.string().optional(),
  embeddingModel: z.string().optional(),
  chunkSize: z.number().min(100).max(4000).optional(),
  chunkOverlap: z.number().min(0).max(1000).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const collections = await getUserCollections(session.user.id)

    // Convert BigInt to string for JSON serialization
    const serializedCollections = collections.map((collection) => ({
      ...collection,
      storageUsed: collection.storageUsed.toString(),
    }))

    return NextResponse.json({ collections: serializedCollections })
  } catch (error) {
    console.error('Failed to fetch collections:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collections' },
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

    const body = await request.json()
    const validatedData = createCollectionSchema.parse(body)

    const collection = await createCollection({
      ...validatedData,
      ownerId: session.user.id,
    })

    // Convert BigInt to string for JSON serialization
    const serializedCollection = {
      ...collection,
      storageUsed: collection.storageUsed.toString(),
    }

    return NextResponse.json({ collection: serializedCollection }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Failed to create collection:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to create collection' },
      { status: 500 }
    )
  }
}
