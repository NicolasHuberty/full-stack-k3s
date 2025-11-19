'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut, Sparkles } from 'lucide-react'
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
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)

  // Store a stable copy of the PDF data that won't be detached
  const pdfDataCopyRef = useRef<ArrayBuffer | null>(null)

  // Track which page should be highlighted (only highlight once on the target page)
  const highlightPageRef = useRef<number | null>(null)

  // AI Bubble state
  const [showAIBubble, setShowAIBubble] = useState(false)
  const [selectedText, setSelectedText] = useState('')

  // Track page number changes and clear highlights when navigating away
  useEffect(() => {
    // Clear highlights from previous page when navigating
    if (pageRef.current && highlightPageRef.current !== null && pageNumber !== highlightPageRef.current) {
      const existingHighlights = pageRef.current.querySelectorAll('.pdf-highlight')
      existingHighlights.forEach(el => {
        if (el instanceof HTMLElement) {
          el.style.removeProperty('background-color')
          el.classList.remove('pdf-highlight')
        }
      })
    }
  }, [pageNumber])

  // Track initialPage changes and apply immediately if document is already loaded
  useEffect(() => {
    const hasValidPage = initialPage !== null && initialPage !== undefined && !isNaN(initialPage) && initialPage > 0 && numPages > 0 && initialPage <= numPages
    if (hasValidPage) {
      setPageNumber(initialPage)
    }
    // Set the target page for highlighting if we have highlightText and initialPage
    if (highlightText && initialPage !== null && initialPage !== undefined && !isNaN(initialPage) && initialPage > 0) {
      console.log('[PDFViewer] Setting highlight target page:', initialPage)
      highlightPageRef.current = initialPage
    }
  }, [initialPage, numPages, highlightText])

  useEffect(() => {
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
        // For normal documents, use the document ID first
        try {
          const response = await fetch(`/api/documents/${documentId}/download`)

          if (!response.ok) {
            throw new Error('Failed to load PDF via ID')
          }

          const data = await response.arrayBuffer()
          // Store a copy for AI bubble (before it gets detached by PDF.js)
          pdfDataCopyRef.current = data.slice(0)
          setPdfData(data)
        } catch (idError) {
          console.warn('Failed to load PDF by ID, trying fallback by name:', idError)

          // Fallback to download-by-name
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
        }
      }
    } catch (err) {
      console.error('Error loading PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF')
    } finally {
      setLoading(false)
    }
  }

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages)

    // Navigate to initial page if specified, otherwise start at page 1
    const hasValidInitialPage = initialPage !== null && initialPage !== undefined && !isNaN(initialPage) && initialPage > 0 && initialPage <= numPages
    const targetPage = hasValidInitialPage ? initialPage : 1
    if (targetPage !== pageNumber) {
      setPageNumber(targetPage)
    }
  }

  // Highlight text when page renders
  const onPageLoadSuccess = () => {
    console.log('[PDFViewer] onPageLoadSuccess called', {
      hasHighlightText: !!highlightText,
      hasPageRef: !!pageRef.current,
      highlightPageTarget: highlightPageRef.current,
      currentPage: pageNumber,
      shouldHighlight: highlightText && pageRef.current && highlightPageRef.current !== null && pageNumber === highlightPageRef.current
    })

    // Only highlight if:
    // 1. We have text to highlight
    // 2. We have a target page set
    // 3. We're currently on that target page
    if (highlightText && pageRef.current && highlightPageRef.current !== null && pageNumber === highlightPageRef.current) {
      console.log('[PDFViewer] Starting highlight process for page', pageNumber)
      // Multiple attempts to ensure text layer is ready
      let attempts = 0
      const tryHighlight = () => {
        attempts++
        const textLayer = pageRef.current?.querySelector('.react-pdf__Page__textContent')

        if (textLayer && textLayer.children.length > 0) {
          console.log('[PDFViewer] Text layer ready, highlighting...')
          highlightTextInPage()
          // Don't clear highlightPageRef - let it persist so highlights remain on re-renders
        } else if (attempts < 10) {
          console.log(`[PDFViewer] Text layer not ready, attempt ${attempts}/10`)
          setTimeout(tryHighlight, 200)
        }
      }

      setTimeout(tryHighlight, 100)
    }
  }

  const highlightTextInPage = () => {
    if (!highlightText || !pageRef.current) {
      return
    }

    console.log('[PDFViewer] ========== HIGHLIGHTING DEBUG ==========')
    console.log('[PDFViewer] Text to highlight:', highlightText)
    console.log('[PDFViewer] Text length:', highlightText.length)

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
      console.log('[PDFViewer] ❌ No text layer found')
      return
    }

    // Get all text spans
    const textElements = Array.from(textLayer.querySelectorAll('span')) as HTMLElement[]
    console.log('[PDFViewer] Found', textElements.length, 'text elements')

    // Normalize function to handle punctuation and spacing
    const normalize = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD') // Decompose accented characters
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
        .trim()
    }

    // Normalize search text and extract words
    const normalizedSearchText = normalize(highlightText)
    const searchWords = normalizedSearchText
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 30)

    console.log('[PDFViewer] Normalized search text:', normalizedSearchText.substring(0, 200))
    console.log('[PDFViewer] Search words:', searchWords)
    console.log('[PDFViewer] Number of search words:', searchWords.length)

    if (searchWords.length === 0) {
      console.log('[PDFViewer] ❌ No valid search words')
      return
    }

    // Build full page text with element mapping
    let fullText = ''
    const charToElement: HTMLElement[] = []

    textElements.forEach(el => {
      const text = normalize(el.textContent || '') // Normalize page text too
      for (let i = 0; i < text.length; i++) {
        charToElement.push(el)
      }
      fullText += text + ' '
      charToElement.push(el) // for the space
    })

    console.log('[PDFViewer] Full page text length:', fullText.length)
    console.log('[PDFViewer] Full page text preview:', fullText.substring(0, 200))

    // For matching, remove ALL spaces to handle character-level spacing in PDFs
    const fullTextNoSpaces = fullText.replace(/\s+/g, '')
    const searchTextNoSpaces = normalizedSearchText.replace(/\s+/g, '').substring(0, 500) // First 500 chars

    console.log('[PDFViewer] Search text (no spaces):', searchTextNoSpaces.substring(0, 100))
    console.log('[PDFViewer] Page text (no spaces) preview:', fullTextNoSpaces.substring(0, 200))

    // Use a sliding window to find the best match, allowing for small differences
    // We'll look for the position where the most characters match
    let bestMatchIndex = -1
    let bestMatchScore = 0
    const searchLen = Math.min(150, searchTextNoSpaces.length) // Use first 150 chars for matching

    // Slide through the page text
    for (let i = 0; i < fullTextNoSpaces.length - searchLen + 1; i++) {
      const window = fullTextNoSpaces.substring(i, i + searchLen)
      let matches = 0

      // Count how many characters match in the same relative position
      for (let j = 0; j < searchLen; j++) {
        if (window[j] === searchTextNoSpaces[j]) {
          matches++
        }
      }

      if (matches > bestMatchScore) {
        bestMatchScore = matches
        bestMatchIndex = i
      }

      // If we found a very good match (>85%), stop searching
      if (matches / searchLen > 0.85) {
        break
      }
    }

    console.log('[PDFViewer] Best match score:', bestMatchScore, '/', searchLen, '=', (bestMatchScore / searchLen * 100).toFixed(1) + '%')
    console.log('[PDFViewer] Match index:', bestMatchIndex)

    let bestStart = -1
    let bestEnd = -1

    // If we found a decent match (>70% of characters), use it
    if (bestMatchIndex >= 0 && bestMatchScore / searchLen > 0.7) {
      // Map back to the original text with spaces to find element positions
      let charsCountedNoSpace = 0

      for (let i = 0; i < fullText.length; i++) {
        if (fullText[i] !== ' ') {
          if (charsCountedNoSpace === bestMatchIndex && bestStart === -1) {
            bestStart = i
          }
          charsCountedNoSpace++
          if (charsCountedNoSpace === bestMatchIndex + 300) { // Highlight ~300 chars
            bestEnd = i
            break
          }
        }
      }

      if (bestEnd === -1) bestEnd = fullText.length

      console.log('[PDFViewer] Best match result:', {
        found: true,
        start: bestStart,
        end: bestEnd,
        matchedText: fullText.substring(bestStart, Math.min(bestEnd, bestStart + 200))
      })
    } else {
      console.log('[PDFViewer] Best match result:', {
        found: false,
        start: -1,
        end: -1,
        reason: 'Match score too low: ' + (bestMatchScore / searchLen * 100).toFixed(1) + '%'
      })
    }

    // Highlight the matched region
    if (bestStart >= 0 && bestEnd > bestStart) {
      const matchedElements = new Set<HTMLElement>()

      for (let i = bestStart; i < Math.min(bestEnd, charToElement.length); i++) {
        if (charToElement[i]) {
          matchedElements.add(charToElement[i])
        }
      }

      console.log('[PDFViewer] Matched elements count:', matchedElements.size)

      // Apply highlighting
      if (matchedElements.size > 0) {
        matchedElements.forEach(element => {
          element.style.setProperty('background-color', 'rgba(255, 235, 59, 0.4)', 'important')
          element.classList.add('pdf-highlight')
        })

        console.log('[PDFViewer] ✅ Highlighting applied to', matchedElements.size, 'elements')

        // Scroll to first highlight
        const firstElement = Array.from(matchedElements)[0]
        if (firstElement && pageRef.current) {
          setTimeout(() => {
            const scrollContainer = pageRef.current?.closest('.overflow-auto')
            if (scrollContainer && firstElement) {
              const elementRect = firstElement.getBoundingClientRect()
              const containerRect = scrollContainer.getBoundingClientRect()

              const scrollTop = scrollContainer.scrollTop +
                (elementRect.top - containerRect.top) -
                (containerRect.height / 2) +
                (elementRect.height / 2)

              scrollContainer.scrollTo({
                top: scrollTop,
                behavior: 'smooth'
              })
              console.log('[PDFViewer] Scrolled to highlight')
            }
          }, 200)
        }
      }
    } else {
      console.log('[PDFViewer] ❌ No match found - no highlighting applied')
    }
    console.log('[PDFViewer] ========================================')
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
      <div className="absolute inset-4 bg-white rounded-lg shadow-xl flex overflow-hidden">
        {/* Main PDF Area */}
        <div className="flex-1 flex flex-col min-w-0 relative">
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
              <div className="w-px h-4 bg-gray-200 mx-1" />
              <Button
                onClick={() => setShowAIBubble(!showAIBubble)}
                variant={showAIBubble ? "secondary" : "ghost"}
                size="sm"
                className={showAIBubble ? "bg-blue-50 text-blue-600" : ""}
              >
                <Sparkles className="h-4 w-4" />
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
                      console.log('[PDFViewer] Page rendered:', pageNumber)
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

        {/* AI Sidebar */}
        {showAIBubble && pdfDataCopyRef.current && (
          <div className="w-[400px] border-l border-gray-200 bg-white z-10 flex-shrink-0">
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
          </div>
        )}
      </div>
    </div>
  )
}