'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, X, Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface AIBubbleProps {
  selectedText: string
  documentId: string
  documentName: string
  collectionId?: string
  currentPage: number
  pdfData: ArrayBuffer
  onClose: () => void
}

export function AIBubble({
  selectedText,
  documentId,
  documentName,
  collectionId,
  currentPage,
  pdfData,
  onClose,
}: AIBubbleProps) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // Focus textarea when modal opens
    textareaRef.current?.focus()
  }, [])

  const handleAskQuestion = async () => {
    if (!question.trim()) return

    setIsLoading(true)
    setError(null)

    try {
      // Convert ArrayBuffer to Base64 to send via JSON
      // The pdfData passed is already a stable copy from the parent
      const pdfBase64 = btoa(
        new Uint8Array(pdfData).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )

      const response = await fetch('/api/pdf/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          documentName,
          collectionId,
          selectedText,
          question: question.trim(),
          currentPage,
          pdfData: pdfBase64,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get answer')
      }

      const data = await response.json()
      setAnswer(data.answer)
    } catch (err) {
      console.error('Error asking question:', err)
      setError(err instanceof Error ? err.message : 'Failed to get answer')
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAskQuestion()
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 rounded-lg">
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">AI Assistant</h2>
        </div>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-white/50"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Selected Text Section */}
        {selectedText && (
          <div className="px-4 py-3 border-b bg-gradient-to-br from-gray-50 to-blue-50/30">
            <p className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
              Selected Context (Page {currentPage})
            </p>
            <div className="bg-white rounded-md p-3 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-700 line-clamp-6 italic leading-relaxed border-l-2 border-blue-300 pl-2">
                &ldquo;{selectedText}&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* Answer Display */}
        {(answer || error) && (
          <div className="px-4 py-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 font-medium mb-1">Error</p>
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}
            {answer && (
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <p className="text-xs font-bold text-blue-900 uppercase tracking-wider">AI Answer</p>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
              </div>
            )}
          </div>
        )}

        {/* Question Input Area - Pushed to bottom if content is short, but scrolls if long */}
        <div className="px-4 py-4">
          {/* Spacer if needed */}
        </div>
      </div>

      {/* Fixed Bottom Input Section */}
      <div className="p-4 border-t bg-white">
        <label className="text-xs font-semibold text-gray-700 mb-2 block">
          Ask a question
        </label>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedText ? "Ask about this selection..." : "Ask about this document..."}
            className="w-full min-h-[80px] text-sm resize-none pr-10 pb-10"
            disabled={isLoading}
          />
          <div className="absolute bottom-2 right-2 left-2 flex justify-between items-center">
            <span className="text-[10px] text-gray-400">Enter to send</span>
            <Button
              onClick={handleAskQuestion}
              disabled={!question.trim() || isLoading}
              size="sm"
              className="h-7 px-3 text-xs gap-1.5"
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Send className="h-3 w-3" />
              )}
              Ask
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
