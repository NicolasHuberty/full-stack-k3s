import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { STTService } from '@/lib/stt/service'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type (basic check)
    if (!file.type.startsWith('audio/')) {
      return NextResponse.json(
        { error: 'Invalid file type. Must be audio.' },
        { status: 400 }
      )
    }

    const language = formData.get('language') as string | undefined

    const sttClient = await STTService.createClient()
    const text = await sttClient.transcribe(file, language)

    return NextResponse.json({ text })
  } catch (error) {
    console.error('Transcription error:', error)
    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    )
  }
}
