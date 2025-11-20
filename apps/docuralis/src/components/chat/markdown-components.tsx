import { FileText, ExternalLink } from 'lucide-react'
import { ReactNode } from 'react'

interface PDFReferenceProps {
  filename: string
  onClick: () => void
}

export function PDFReference({ filename, onClick }: PDFReferenceProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 mx-0.5 rounded-md bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:border-blue-300 transition-all group text-sm font-medium text-blue-700 hover:text-blue-800"
    >
      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate max-w-[200px]">{filename}</span>
      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  )
}

interface CustomMarkdownComponentsProps {
  onPdfClick: (filename: string) => void
  documentChunks?: Array<{
    documentName?: string
    metadata?: { title?: string }
  }>
}

export function getCustomMarkdownComponents(
  componentProps: CustomMarkdownComponentsProps
) {
  // Helper to map document numbers to filenames
  const getFilenameFromDocNumber = (docNum: number): string | null => {
    if (
      !componentProps.documentChunks ||
      !componentProps.documentChunks[docNum - 1]
    ) {
      return null
    }
    const chunk = componentProps.documentChunks[docNum - 1]
    return chunk.documentName || chunk.metadata?.title || null
  }

  return {
    // Headings with proper styling
    h1: (props: any) => (
      <h1
        className="text-2xl font-bold mt-6 mb-4 text-gray-900 border-b pb-2"
        {...props}
      />
    ),
    h2: (props: any) => (
      <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900" {...props} />
    ),
    h3: (props: any) => (
      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900" {...props} />
    ),
    h4: (props: any) => (
      <h4
        className="text-base font-semibold mt-3 mb-2 text-gray-800"
        {...props}
      />
    ),

    // Custom text renderer to detect and transform PDF references
    p: (props: any) => {
      const { children, ...htmlProps } = props
      const processChildren = (children: ReactNode): ReactNode => {
        if (typeof children === 'string') {
          // Match patterns like:
          // 1. <filename.pdf> or <IT0012930_003.pdf>
          // 2. Document 1, Document 2, etc.
          const parts = children.split(/(<[^>]+\.pdf>|Document \d+)/g)

          return parts.map((part, index) => {
            // Check if this part is a PDF reference in <filename.pdf> format
            const pdfMatch = part.match(/^<([^>]+\.pdf)>$/)
            if (pdfMatch) {
              const filename = pdfMatch[1]
              return (
                <PDFReference
                  key={`pdf-${index}`}
                  filename={filename}
                  onClick={() => componentProps.onPdfClick(filename)}
                />
              )
            }

            // Check if this part is a "Document N" reference
            const docMatch = part.match(/^Document (\d+)$/)
            if (docMatch) {
              const docNumber = parseInt(docMatch[1])
              const filename = getFilenameFromDocNumber(docNumber)

              if (filename) {
                return (
                  <PDFReference
                    key={`doc-${index}`}
                    filename={filename}
                    onClick={() => componentProps.onPdfClick(filename)}
                  />
                )
              }
            }

            return part
          })
        }

        return children
      }

      return (
        <p className="mb-4 text-gray-700 leading-relaxed" {...htmlProps}>
          {processChildren(children)}
        </p>
      )
    },

    // Text formatting
    strong: (props: any) => (
      <strong className="font-bold text-gray-900" {...props} />
    ),

    // Emphasis
    em: (props: any) => (
      <em className="italic text-gray-700" {...props} />
    ),

    // Lists
    ul: (props: any) => (
      <ul className="list-disc list-inside my-4 space-y-2" {...props} />
    ),
    ol: (props: any) => (
      <ol className="list-decimal list-inside my-4 space-y-2" {...props} />
    ),
    li: (props: any) => (
      <li className="text-gray-700" {...props} />
    ),

    // Blockquotes
    blockquote: (props: any) => (
      <blockquote
        className="border-l-4 border-blue-500 pl-4 py-2 mb-4 italic bg-gray-50 text-gray-700"
        {...props}
      />
    ),

    // Horizontal rules
    hr: (props: any) => (
      <hr className="my-6 border-t border-gray-300" {...props} />
    ),

    // Links
    a: (props: any) => (
      <a
        {...props}
        className="text-blue-600 hover:text-blue-800 underline"
        target="_blank"
        rel="noopener noreferrer"
      />
    ),

    // Also handle inline code that might contain PDF references
    code: (props: any) => {
      const { children, className, ...htmlProps } = props
      // Check if it's a code block (has language class)
      if (className && className.includes('language-')) {
        return (
          <code className={`${className} text-sm`} {...htmlProps}>
            {children}
          </code>
        )
      }

      // For inline code, check for PDF references
      if (typeof children === 'string' && children.includes('.pdf')) {
        const pdfMatch = children.match(/^([^.]+\.pdf)$/)
        if (pdfMatch) {
          const filename = pdfMatch[1]
          return (
            <PDFReference
              filename={filename}
              onClick={() => componentProps.onPdfClick(filename)}
            />
          )
        }
      }

      return (
        <code
          className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono"
          {...htmlProps}
        >
          {children}
        </code>
      )
    },

    // Code blocks
    pre: (props: any) => (
      <pre
        className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"
        {...props}
      />
    ),
  }
}