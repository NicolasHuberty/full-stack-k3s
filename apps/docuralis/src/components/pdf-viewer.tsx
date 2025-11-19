'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AIBubble } from '@/components/pdf/ai-bubble'

// Import PDF.js CSS styles
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Dynamically import react-pdf components to avoid SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => ({ default: mod.Document })), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 rounded w-full h-96" />
})

const Page = dynamic(() => import('react-pdf').then(mod => ({ default: mod.Page })), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-gray-200 rounded w-full h-96" />
})

// Configure PDF.js worker when client-side
if (typeof window !== 'undefined') {
  const { pdfjs } = require('react-pdf')
  // Use the exact version that react-pdf@10.2.0 depends on: pdfjs-dist@5.4.296
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.296/build/pdf.worker.min.mjs`
}

interface PDFViewerProps {
  documentId: string
  documentName: string
  collectionId?: string
  initialPage?: number
  highlightText?: string
  onClose: () => void
}

export function PDFViewer({ documentId, documentName, collectionId, initialPage, highlightText, onClose }: PDFViewerProps) {
  console.log(`🔧 [PDFViewer] CONSTRUCTOR - initialPage received:`, {
    initialPage,
    initialPageType: typeof initialPage,
    initialPageValue: initialPage,
    documentName
  })

  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  // Store a stable copy of the PDF data that won't be detached
  const pdfDataCopyRef = useRef<ArrayBuffer | null>(null)

  // AI Bubble state
  const [showAIBubble, setShowAIBubble] = useState(false)
  const [selectedText, setSelectedText] = useState('')

  console.log(`📊 [PDFViewer] STATE INITIALIZED - pageNumber:`, pageNumber, 'initialPage:', initialPage)

  // Track page number changes
  useEffect(() => {
    console.log(`📄 [PDFViewer] PAGE NUMBER STATE CHANGED: ${pageNumber}`)
  }, [pageNumber])

  // Track initialPage changes and apply immediately if document is already loaded
  useEffect(() => {
    console.log(`🎯 [PDFViewer] INITIAL PAGE PROP CHANGED: ${initialPage}`)

    const hasValidPage = initialPage !== null && initialPage !== undefined && !isNaN(initialPage) && initialPage > 0 && numPages > 0 && initialPage <= numPages
    if (hasValidPage) {
      console.log(`🔧 [PDFViewer] APPLYING INITIAL PAGE via useEffect: ${initialPage}`)
      setPageNumber(initialPage)
    } else {
      console.log(`⚠️  [PDFViewer] Cannot apply initial page - initialPage: ${initialPage}, numPages: ${numPages}, valid: ${hasValidPage}`)
    }
  }, [initialPage, numPages])

  useEffect(() => {
    console.log('[PDFViewer] Component mounted with props:', {
      documentId,
      documentName,
      collectionId,
      collectionIdType: typeof collectionId,
      initialPage,
      initialPageType: typeof initialPage,
      highlightText: highlightText?.substring(0, 50)
    })
    loadPDF()
  }, [documentId])

  // Handle text selection for AI bubble
  useEffect(() => {
    const handleTextSelection = () => {
      const selection = window.getSelection()
      const text = selection?.toString().trim()

      if (text && text.length > 10) {
        // Only show modal for meaningful selections (>10 chars)
        setSelectedText(text)
        setShowAIBubble(true)
      }
    }

    // Listen for mouseup events to detect text selection
    document.addEventListener('mouseup', handleTextSelection)

    return () => {
      document.removeEventListener('mouseup', handleTextSelection)
    }
  }, [])

  const loadPDF = async () => {
    try {
      setLoading(true)
      setError(null)

      // Check if it's a migrated document (no DB record)
      if (documentId.startsWith('migrated_')) {
        // For migrated documents, try to fetch directly from MinIO using the documentName
        console.log('[PDFViewer] Requesting migrated document:', { documentName, collectionId })

        const response = await fetch(`/api/documents/download-by-name`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: documentName, collectionId }),
        })

        if (!response.ok) {
          throw new Error('Failed to load PDF')
        }

        const data = await response.arrayBuffer()
        // Store a copy for AI bubble (before it gets detached by PDF.js)
        pdfDataCopyRef.current = data.slice(0)
        setPdfData(data)
      } else {
        // For normal documents, use the document ID
        const response = await fetch(`/api/documents/${documentId}/download`)

        if (!response.ok) {
          throw new Error('Failed to load PDF')
        }

        const data = await response.arrayBuffer()
        // Store a copy for AI bubble (before it gets detached by PDF.js)
        pdfDataCopyRef.current = data.slice(0)
        setPdfData(data)
      }
    } catch (err) {
      console.error('Error loading PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setLoading(false)
    }
  }

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    console.log(`🔥 [PDFViewer] onDocumentLoadSuccess called with numPages: ${numPages}`)
    console.log(`🔥 [PDFViewer] Current state - pageNumber: ${pageNumber}, initialPage: ${initialPage}`)

    setNumPages(numPages)

    // Navigate to initial page if specified, otherwise start at page 1
    const hasValidInitialPage = initialPage !== null && initialPage !== undefined && !isNaN(initialPage) && initialPage > 0 && initialPage <= numPages
    const targetPage = hasValidInitialPage ? initialPage : 1

    console.log(`🎯 [PDFViewer] PAGE NAVIGATION LOGIC:`)
    console.log(`    - numPages: ${numPages}`)
    console.log(`    - initialPage: ${initialPage} (type: ${typeof initialPage})`)
    console.log(`    - initialPage !== null: ${initialPage !== null}`)
    console.log(`    - initialPage !== undefined: ${initialPage !== undefined}`)
    console.log(`    - !isNaN(initialPage): ${initialPage !== undefined && !isNaN(initialPage)}`)
    console.log(`    - initialPage > 0: ${initialPage && initialPage > 0}`)
    console.log(`    - initialPage <= numPages: ${initialPage && initialPage <= numPages}`)
    console.log(`    - hasValidInitialPage: ${hasValidInitialPage}`)
    console.log(`    - targetPage calculated: ${targetPage}`)
    console.log(`    - current pageNumber: ${pageNumber}`)
    console.log(`    - will change page: ${targetPage !== pageNumber}`)

    if (targetPage !== pageNumber) {
      console.log(`🚀 [PDFViewer] SETTING PAGE NUMBER from ${pageNumber} to ${targetPage}`)
      setPageNumber(targetPage)
    } else {
      console.log(`⚠️  [PDFViewer] NO PAGE CHANGE - target (${targetPage}) === current (${pageNumber})`)
    }
  }

  // Highlight text when page renders
  const onPageLoadSuccess = () => {
    if (highlightText && pageRef.current) {
      // Multiple attempts to ensure text layer is ready
      let attempts = 0
      const tryHighlight = () => {
        attempts++
        const textLayer = pageRef.current?.querySelector('.react-pdf__Page__textContent')

        if (textLayer && textLayer.children.length > 0) {
          console.log('[PDFViewer] Text layer ready, highlighting text:', highlightText.substring(0, 100))
          highlightTextInPage()
        } else if (attempts < 10) {
          console.log(`[PDFViewer] Text layer not ready, attempt ${attempts}/10`)
          setTimeout(tryHighlight, 200)
        } else {
          console.warn('[PDFViewer] Text layer failed to load after 10 attempts')
        }
      }

      setTimeout(tryHighlight, 100)
    }
  }

  const highlightTextInPage = () => {
    if (!highlightText || !pageRef.current) {
      return
    }

    // Remove existing highlights
    const existingHighlights = pageRef.current.querySelectorAll('.pdf-highlight')
    existingHighlights.forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.removeProperty('background-color')
        el.classList.remove('pdf-highlight')
      }
    })

    // Find and highlight text
    const textLayer = pageRef.current.querySelector('.react-pdf__Page__textContent')
    if (!textLayer) {
      return
    }

    // Get all text spans
    const textElements = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[]

    // Simple word-based matching for better performance
    const searchWords = highlightText
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2) // Only meaningful words
      .slice(0, 15) // Limit to first 15 words for performance

    if (searchWords.length === 0) return

    // Build a map of elements with their text content
    const elementsWithText = textElements.map(el => ({
      element: el,
      text: (el.textContent || '').toLowerCase().trim(),
    }))

    // Find sequences of elements that contain our search words
    const matchedElements = new Set<HTMLElement>()
    let wordsFound = 0
    let consecutiveMatches = 0

    for (let i = 0; i < elementsWithText.length; i++) {
      const currentText = elementsWithText[i].text

      // Check if this element contains any of our search words
      const hasMatch = searchWords.some(word => currentText.includes(word))

      if (hasMatch) {
        matchedElements.add(elementsWithText[i].element)
        wordsFound++
        consecutiveMatches++

        // Also add nearby elements for context (up to 2 before and after)
        for (let j = Math.max(0, i - 2); j < Math.min(elementsWithText.length, i + 3); j++) {
          matchedElements.add(elementsWithText[j].element)
        }
      } else {
        // Reset consecutive counter if we haven't found enough words
        if (consecutiveMatches < 3) {
          consecutiveMatches = 0
        }
      }

      // Stop if we found enough matches
      if (wordsFound >= Math.min(searchWords.length, 8)) {
        break
      }
    }

    // Apply highlighting
    if (matchedElements.size > 0) {
      matchedElements.forEach(element => {
        element.style.setProperty('background-color', 'rgba(255, 235, 59, 0.4)', 'important')
        element.classList.add('pdf-highlight')
      })

      // Scroll to first highlight
      const firstElement = Array.from(matchedElements)[0]
      if (firstElement) {
        setTimeout(() => {
          firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 100)
      }
    }
  }

  const changePage = (offset: number) => {
    setPageNumber((prevPageNumber) => {
      const newPage = prevPageNumber + offset
      return Math.min(Math.max(1, newPage), numPages)
    })
  }

  const changeZoom = (delta: number) => {
    setScale((prevScale) => {
      const newScale = prevScale + delta
      return Math.min(Math.max(0.5, newScale), 2.0)
    })
  }

  const downloadPDF = () => {
    if (pdfData) {
      const blob = new Blob([pdfData], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = documentName
      link.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-4 bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold truncate max-w-md">{documentName}</h2>
            <span className="text-sm text-gray-500">
              Page {pageNumber} of {numPages || '-'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => changeZoom(-0.1)}
              variant="ghost"
              size="sm"
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <Button
              onClick={() => changeZoom(0.1)}
              variant="ghost"
              size="sm"
              disabled={scale >= 2.0}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button onClick={downloadPDF} variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
            <Button onClick={onClose} variant="ghost" size="sm">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* PDF Content */}
        <div className="flex-1 overflow-auto flex justify-center items-start p-4 bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <p className="font-semibold mb-2">Error loading PDF</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && pdfData && (
            <div ref={pageRef}>
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="animate-pulse bg-gray-200 rounded w-full h-96" />
                }
                error={
                  <div className="text-red-600 p-4">Failed to load PDF document</div>
                }
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  className="shadow-lg"
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  onLoadSuccess={() => {
                    console.log(`📄 [PDFViewer] PAGE RENDERED - pageNumber: ${pageNumber}`)
                    onPageLoadSuccess()
                  }}
                />
              </Document>
            </div>
          )}
        </div>

        {/* Footer with navigation */}
        {numPages > 0 && (
          <div className="flex items-center justify-center gap-4 px-4 py-3 border-t bg-white">
            <Button
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={numPages}
                value={pageNumber}
                onChange={(e) => {
                  const val = parseInt(e.target.value)
                  if (!isNaN(val) && val >= 1 && val <= numPages) {
                    setPageNumber(val)
                  }
                }}
                className="w-16 px-2 py-1 text-center border rounded"
              />
              <span className="text-sm text-gray-600">/ {numPages}</span>
            </div>

            <Button
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              variant="outline"
              size="sm"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* AI Modal */}
      {showAIBubble && pdfDataCopyRef.current && (
        <AIBubble
          selectedText={selectedText}
          documentId={documentId}
          documentName={documentName}
          collectionId={collectionId}
          currentPage={pageNumber}
          pdfData={pdfDataCopyRef.current}
          onClose={() => {
            setShowAIBubble(false)
            setSelectedText('')
            // Clear text selection
            window.getSelection()?.removeAllRanges()
          }}
        />
      )}
    </div>
  )
}