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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* Modal */}
        <div
          className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-3xl max-h-[90vh] flex flex-col m-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Ask AI about selection</h2>
            </div>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-white/50"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Selected Text */}
          <div className="px-6 py-4 border-b bg-gradient-to-br from-gray-50 to-blue-50/30">
            <p className="text-sm font-medium text-gray-600 mb-2">Selected text from page {currentPage}:</p>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <p className="text-base text-gray-800 line-clamp-4 italic leading-relaxed">
                "{selectedText.substring(0, 300)}
                {selectedText.length > 300 ? '...' : ''}"
              </p>
            </div>
          </div>

          {/* Question Input */}
          <div className="px-6 py-5 border-b bg-white">
            <label className="text-sm font-medium text-gray-700 mb-3 block">
              Your question:
            </label>
            <Textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about this text..."
              className="w-full min-h-[120px] text-base resize-none"
              disabled={isLoading}
            />
            <div className="flex justify-between items-center mt-3">
              <p className="text-sm text-gray-500">
                Press Enter to send, Shift+Enter for new line
              </p>
              <Button
                onClick={handleAskQuestion}
                disabled={!question.trim() || isLoading}
                size="lg"
                className="gap-2 px-6"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Thinking...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" />
                    Ask AI
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Answer Display */}
          {(answer || error) && (
            <div className="px-6 py-5 flex-1 overflow-y-auto">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                  <p className="text-base text-red-700 font-medium mb-1">Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}
              {answer && (
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-5 w-5 text-blue-600" />
                    <p className="text-sm font-semibold text-blue-900">AI Answer:</p>
                  </div>
                  <p className="text-base text-gray-800 whitespace-pre-wrap leading-relaxed">{answer}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer Tips */}
          {!answer && !error && !isLoading && (
            <div className="px-6 py-4 bg-gradient-to-br from-gray-50 to-blue-50/20 rounded-b-xl border-t">
              <div className="flex items-start gap-2">
                <Sparkles className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-700">
                  The AI has access to the document metadata, the first 2 pages for context, and your selected text.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
