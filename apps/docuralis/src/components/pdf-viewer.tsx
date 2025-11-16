'use client'

import { useState, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, X, Download, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Configure PDF.js worker - use version-specific worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.4.394/build/pdf.worker.min.mjs`

interface PDFViewerProps {
  documentId: string
  documentName: string
  collectionId?: string
  onClose: () => void
}

export function PDFViewer({ documentId, documentName, collectionId, onClose }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.0)
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPDF()
  }, [documentId])

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
        setPdfData(data)
      } else {
        // For normal documents, use the document ID
        const response = await fetch(`/api/documents/${documentId}/download`)

        if (!response.ok) {
          throw new Error('Failed to load PDF')
        }

        const data = await response.arrayBuffer()
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
    setNumPages(numPages)
    setPageNumber(1)
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
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
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
    </div>
  )
}