import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface AudioRecorderProps {
  onTranscriptionComplete: (text: string) => void
  className?: string
}

const MAX_DURATION = 120 // 2 minutes in seconds

export function AudioRecorder({
  onTranscriptionComplete,
  className,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (duration >= MAX_DURATION && isRecording) {
      stopRecording()
      toast({
        title: 'Recording Limit Reached',
        description: 'Recording stopped automatically after 2 minutes.',
        variant: 'default',
      })
    }
  }, [duration, isRecording])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await processAudio(audioBlob)

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive',
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsProcessing(true)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')

      // Get browser language (e.g., 'fr-FR' -> 'fr')
      const language = navigator.language.split('-')[0]
      if (language) {
        formData.append('language', language)
      }

      const response = await fetch('/api/stt/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Transcription failed')
      }

      const data = await response.json()
      if (data.text) {
        onTranscriptionComplete(data.text)
      }
    } catch (error) {
      console.error('Transcription error:', error)
      toast({
        title: 'Transcription Failed',
        description: 'Failed to transcribe audio. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
      setDuration(0)
    }
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isRecording && (
        <span
          className={cn(
            'text-xs font-mono',
            duration > 100 ? 'text-red-500' : 'text-muted-foreground'
          )}
        >
          {formatDuration(duration)} / 2:00
        </span>
      )}

      {isProcessing ? (
        <Button variant="ghost" size="icon" disabled className="animate-pulse">
          <Loader2 className="h-4 w-4 animate-spin" />
        </Button>
      ) : isRecording ? (
        <Button
          variant="destructive"
          size="icon"
          onClick={stopRecording}
          className="animate-pulse relative"
          title="Stop recording"
        >
          <Square className="h-4 w-4" />
          {/* Progress ring could go here, but simple timer is fine for now */}
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          onClick={startRecording}
          title="Start recording"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
