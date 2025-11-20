import React from 'react'
import { FileText, ExternalLink } from 'lucide-react'

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
    h1: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h1
        className="text-2xl font-bold mt-6 mb-4 text-gray-900 border-b pb-2"
        {...props}
      >
        {children}
      </h1>
    ),
    h2: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h4
        className="text-base font-semibold mt-3 mb-2 text-gray-800"
        {...props}
      >
        {children}
      </h4>
    ),

    // Custom text renderer to detect and transform PDF references
    p: ({
      children,
      ...htmlProps
    }: React.HTMLAttributes<HTMLParagraphElement>) => {
      const processChildren = (children: React.ReactNode): React.ReactNode => {
        if (typeof children === 'string') {
          // Match patterns like:
          // 1. <filename.pdf> or <IT0012930_003.pdf>
          // 2. <document 1> or <document 2> (legacy format)
          const pdfRegex =
            /&lt;([^&]+\.pdf)&gt;|<([^<]+\.pdf)>|&lt;document\s+(\d+)&gt;|<document\s+(\d+)>/gi
          const parts = []
          let lastIndex = 0
          let match

          while ((match = pdfRegex.exec(children)) !== null) {
            // Add text before the match
            if (match.index > lastIndex) {
              parts.push(children.substring(lastIndex, match.index))
            }

            // Determine the filename
            let filename: string | null = null

            if (match[1] || match[2]) {
              // Direct PDF filename
              filename = match[1] || match[2]
            } else if (match[3] || match[4]) {
              // Document number - try to map to actual filename
              const docNum = parseInt(match[3] || match[4], 10)
              filename = getFilenameFromDocNumber(docNum)

              // Fallback to displaying the document number if no mapping found
              if (!filename) {
                filename = `Document ${docNum}`
              }
            }

            if (filename) {
              parts.push(
                <PDFReference
                  key={`pdf-${match.index}`}
                  filename={filename}
                  onClick={() => componentProps.onPdfClick(filename!)}
                />
              )
            }

            lastIndex = match.index + match[0].length
          }

          // Add remaining text
          if (lastIndex < children.length) {
            parts.push(children.substring(lastIndex))
          }

          // If we found any matches, return the processed parts
          if (parts.length > 0) {
            return parts
          }
        }

        // Handle arrays of children
        if (Array.isArray(children)) {
          return children.map((child, i) => {
            if (typeof child === 'string') {
              return processChildren(child)
            }
            return child
          })
        }

        return children
      }

      return (
        <p className="mb-4 leading-7 text-gray-700" {...htmlProps}>
          {processChildren(children)}
        </p>
      )
    },

    // Strong/Bold text
    strong: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <strong className="font-bold text-gray-900" {...props}>
        {children}
      </strong>
    ),

    // Emphasis/Italic
    em: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <em className="italic text-gray-800" {...props}>
        {children}
      </em>
    ),

    // Unordered lists
    ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
      <ul className="list-disc list-outside ml-6 mb-4 space-y-2" {...props}>
        {children}
      </ul>
    ),

    // Ordered lists
    ol: ({ children, ...props }: React.HTMLAttributes<HTMLOListElement>) => (
      <ol className="list-decimal list-outside ml-6 mb-4 space-y-2" {...props}>
        {children}
      </ol>
    ),

    // List items
    li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
      <li className="text-gray-700 leading-7" {...props}>
        {children}
      </li>
    ),

    // Blockquotes
    blockquote: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLQuoteElement>) => (
      <blockquote
        className="border-l-4 border-blue-500 pl-4 py-2 mb-4 italic bg-gray-50 text-gray-700"
        {...props}
      >
        {children}
      </blockquote>
    ),

    // Horizontal rules
    hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
      <hr className="my-6 border-t border-gray-300" {...props} />
    ),

    // Links
    a: ({
      children,
      href,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
      <a
        href={href}
        className="text-blue-600 hover:text-blue-800 underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),

    // Also handle inline code that might contain PDF references
    code: ({
      children,
      className,
      ...htmlProps
    }: React.HTMLAttributes<HTMLElement> & { className?: string }) => {
      const inline = !className
      const text = String(children)

      // Check if it's a PDF filename in inline code
      if (inline && /\.pdf$/i.test(text.trim())) {
        return (
          <PDFReference
            filename={text.trim()}
            onClick={() => componentProps.onPdfClick(text.trim())}
          />
        )
      }

      // Inline code styling
      if (inline) {
        return (
          <code
            className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-sm font-mono"
            {...htmlProps}
          >
            {children}
          </code>
        )
      }

      // Code blocks
      return (
        <code
          className={`${className} block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4`}
          {...htmlProps}
        >
          {children}
        </code>
      )
    },

    // Pre blocks (for code blocks)
    pre: ({ children, ...props }: React.HTMLAttributes<HTMLPreElement>) => (
      <pre className="mb-4 overflow-x-auto" {...props}>
        {children}
      </pre>
    ),
  }
}
