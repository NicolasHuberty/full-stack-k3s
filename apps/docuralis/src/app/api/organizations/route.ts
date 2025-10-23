import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  createOrganization,
  getOrganizationsByUserId,
} from '@/lib/organization'
import { z } from 'zod'

const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  slug: z
    .string()
    .min(1, 'Organization slug is required')
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens'
    ),
  domain: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const organizations = await getOrganizationsByUserId(session.user.id)

    // Convert BigInt to string for JSON serialization
    const serializedOrgs = organizations.map((org) => ({
      ...org,
      storageUsed: org.storageUsed.toString(),
      storageLimit: org.storageLimit.toString(),
    }))

    return NextResponse.json({ organizations: serializedOrgs })
  } catch (error) {
    console.error('Failed to fetch organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
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
    const validatedData = createOrgSchema.parse(body)

    const organization = await createOrganization({
      name: validatedData.name,
      slug: validatedData.slug,
      ownerId: session.user.id,
      domain: validatedData.domain,
    })

    // Convert BigInt to string for JSON serialization
    const serializedOrg = {
      ...organization,
      storageUsed: organization.storageUsed.toString(),
      storageLimit: organization.storageLimit.toString(),
      members: organization.members.map((member) => ({
        ...member,
        user: {
          ...member.user,
          storageUsed: member.user.storageUsed.toString(),
          storageLimit: member.user.storageLimit.toString(),
        },
      })),
    }

    return NextResponse.json({ organization: serializedOrg }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Failed to create organization:', error)

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    )
  }
}
