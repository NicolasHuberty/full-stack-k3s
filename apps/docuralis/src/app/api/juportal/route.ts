import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'

const ECLI_API_BASE = 'https://ecli.openjustice.be'
const JUPORTAL_BASE = 'https://juportal.be'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const ecli = searchParams.get('ecli')
    const court = searchParams.get('court')
    const year = searchParams.get('year')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (ecli) {
      // Fetch specific ECLI document
      const response = await fetch(`${ECLI_API_BASE}/ecli/${ecli}`, {
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch ECLI: ${response.status}` },
          { status: response.status }
        )
      }

      const data = await response.json()
      return NextResponse.json(data)
    } else {
      // Search for documents (this is a placeholder as the actual JUPORTAL search API is not documented)
      // In production, you would need to integrate with the actual JUPORTAL search API
      const searchCriteria: Record<string, unknown> = {}

      if (court) searchCriteria.court = court
      if (year) searchCriteria.year = year

      // For now, return sample ECLIs that match the criteria
      const sampleResults = [
        {
          ecli: 'ECLI:BE:CASS:2023:ARR.20231125.1',
          court: 'Court of Cassation',
          year: '2023',
          title: 'Criminal Law - Appeal',
          date: '2023-11-25',
        },
        {
          ecli: 'ECLI:BE:CC:2023:141',
          court: 'Constitutional Court',
          year: '2023',
          title: 'Constitutional Review',
          date: '2023-10-15',
        },
        {
          ecli: 'ECLI:BE:GHARB:2023:ARR.20230318.2',
          court: 'Court of Appeal Brussels',
          year: '2023',
          title: 'Civil Law - Contract Dispute',
          date: '2023-03-18',
        },
      ]
        .filter((item) => {
          if (court && !item.court.toLowerCase().includes(court.toLowerCase()))
            return false
          if (year && item.year !== year) return false
          return true
        })
        .slice(0, limit)

      return NextResponse.json({
        results: sampleResults,
        total: sampleResults.length,
        limit,
        message:
          'Note: This is sample data. Full JUPORTAL integration requires official API access.',
      })
    }
  } catch (error) {
    console.error('JUPORTAL API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch JUPORTAL data' },
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
    const { eclis, collectionId } = body

    if (!eclis || !Array.isArray(eclis)) {
      return NextResponse.json(
        { error: 'ECLIs array is required' },
        { status: 400 }
      )
    }

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      )
    }

    // Verify collection ownership
    const collection = await prisma.collection.findFirst({
      where: {
        id: collectionId,
        OR: [
          { ownerId: session.user.id },
          {
            organization: {
              members: {
                some: {
                  userId: session.user.id,
                  isActive: true,
                },
              },
            },
          },
        ],
      },
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found or access denied' },
        { status: 404 }
      )
    }

    const results = []
    const errors = []

    for (const ecli of eclis) {
      try {
        const response = await fetch(`${ECLI_API_BASE}/ecli/${ecli}`, {
          headers: {
            Accept: 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()

          // Create document in database
          const document = await prisma.document.create({
            data: {
              name: ecli,
              originalName: `${ecli}.json`,
              mimeType: 'application/json',
              size: JSON.stringify(data).length,
              collectionId,
              uploadedById: session.user.id,
              metadata: {
                source: 'JUPORTAL',
                ecli,
                court: ecli.split(':')[2],
                year: ecli.split(':')[3],
              },
              status: 'PENDING',
            },
          })

          results.push({
            ecli,
            documentId: document.id,
            status: 'success',
          })

          // TODO: Queue document for processing (embedding generation)
        } else {
          errors.push({
            ecli,
            error: `HTTP ${response.status}`,
          })
        }
      } catch (error) {
        errors.push({
          ecli,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return NextResponse.json({
      success: results,
      errors,
      total: eclis.length,
      imported: results.length,
      failed: errors.length,
    })
  } catch (error) {
    console.error('JUPORTAL import error:', error)
    return NextResponse.json(
      { error: 'Failed to import JUPORTAL documents' },
      { status: 500 }
    )
  }
}
