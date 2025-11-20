import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { fetchRSSFeed, JUPORTAL_RSS_FEEDS } from '@/../scripts/fetch-juportal-rss'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const feedUrl = searchParams.get('url')

    if (!feedUrl) {
      // Return available predefined feeds
      return NextResponse.json({
        availableFeeds: Object.entries(JUPORTAL_RSS_FEEDS).map(([name, url]) => ({
          name,
          url,
          description: `JUPORTAL RSS feed for ${name}`
        })),
        message: 'Provide a feed URL parameter to fetch documents from a specific RSS feed'
      })
    }

    // Fetch documents from the RSS feed
    const documents = await fetchRSSFeed(feedUrl)

    return NextResponse.json({
      feedUrl,
      documents,
      count: documents.length,
      message: `Found ${documents.length} jurisprudence documents`
    })
  } catch (error) {
    console.error('JUPORTAL RSS API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch JUPORTAL RSS feed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { feedUrl, collectionId } = body

    if (!feedUrl) {
      return NextResponse.json(
        { error: 'Feed URL is required' },
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
                  isActive: true
                }
              }
            }
          }
        ]
      }
    })

    if (!collection) {
      return NextResponse.json(
        { error: 'Collection not found or access denied' },
        { status: 404 }
      )
    }

    // Fetch documents from RSS feed
    const documents = await fetchRSSFeed(feedUrl)

    const results = []
    const errors = []

    for (const doc of documents) {
      try {
        const filename = `${doc.ecli || doc.guid}.html`

        // Check if document already exists
        const existingDoc = await prisma.document.findFirst({
          where: {
            collectionId: collection.id,
            filename: filename
          }
        })

        if (!existingDoc) {
          const document = await prisma.document.create({
            data: {
              filename: filename,
              originalName: filename,
              mimeType: 'text/html',
              fileSize: BigInt((doc.contentEncoded || doc.description).length),
              fileUrl: doc.link,
              collectionId: collection.id,
              uploadedById: session.user.id,
              title: doc.title || doc.ecli || 'Untitled',
              status: 'PENDING',
              extractedText: doc.contentEncoded || doc.description
            }
          })

          results.push({
            ecli: doc.ecli,
            title: doc.title,
            documentId: document.id,
            status: 'imported'
          })
        } else {
          results.push({
            ecli: doc.ecli,
            title: doc.title,
            documentId: existingDoc.id,
            status: 'exists'
          })
        }
      } catch (error) {
        errors.push({
          ecli: doc.ecli || doc.guid,
          title: doc.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      feedUrl,
      collectionId,
      results,
      errors,
      summary: {
        total: documents.length,
        imported: results.filter(r => r.status === 'imported').length,
        existing: results.filter(r => r.status === 'exists').length,
        failed: errors.length
      }
    })
  } catch (error) {
    console.error('JUPORTAL RSS import error:', error)
    return NextResponse.json(
      { error: 'Failed to import JUPORTAL documents' },
      { status: 500 }
    )
  }
}