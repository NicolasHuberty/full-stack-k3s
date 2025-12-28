import { NextResponse } from 'next/server'
import { executeJuportalSearch } from '@/lib/tools/juportal'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query') || 'action paulienne'

    console.log('[TEST-JUPORTAL] Testing with query:', query)

    // Test the actual search function
    const result = await executeJuportalSearch({
      query,
      limit: 10,
      languages: ['FR', 'NL', 'DE'],
    })

    return NextResponse.json({
      success: result.success,
      query,
      totalCount: result.data?.totalCount || 0,
      documentCount: result.data?.documents?.length || 0,
      documents: result.data?.documents?.slice(0, 5).map((doc) => ({
        ecli: doc.ecli,
        courtName: doc.courtName,
        decisionDate: doc.decisionDate,
        url: doc.url,
        summary: doc.summary?.slice(0, 200) + '...',
      })),
      error: result.error,
      metadata: result.metadata,
    })
  } catch (error) {
    console.error('[TEST-JUPORTAL] Error:', error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
