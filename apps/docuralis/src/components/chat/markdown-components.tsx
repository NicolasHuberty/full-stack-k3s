import { FileText, ExternalLink } from 'lucide-react'
import { ReactNode, Children, isValidElement, cloneElement } from 'react'

// Source reference interface matching the agent's SourceReference
export interface SourceReference {
  id: string
  type: 'rag' | 'jurisprudence' | 'legislation'
  title: string
  url?: string
  excerpt?: string
  ecli?: string
  courtName?: string
  decisionDate?: string
  documentName?: string
  pageNumber?: number
  numac?: string
  documentType?: string
  publicationDate?: string
}

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

// Inline Citation Component - clean, sober style
interface CitationBadgeProps {
  source: SourceReference | null
  number: string
  sourceType: 'rag' | 'jur' | 'leg'
}

export function CitationBadge({ source, number }: CitationBadgeProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const url = source?.url
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else if (source?.ecli) {
      window.open(
        `https://juportal.be/content/${encodeURIComponent(source.ecli)}`,
        '_blank',
        'noopener,noreferrer'
      )
    }
  }

  // Get display name
  let displayName = `Source ${number}`
  if (source) {
    if (source.type === 'jurisprudence' && source.ecli) {
      displayName = source.ecli
    } else if (source.type === 'legislation') {
      const title = source.title || ''
      displayName = title.length > 40 ? title.substring(0, 40) + '...' : title
    } else {
      displayName = source.documentName || source.title || `Source ${number}`
    }
  }

  // Build tooltip text with more details
  let tooltipTitle = displayName
  if (source?.excerpt) {
    tooltipTitle += `\n\n${source.excerpt.slice(0, 200)}...`
  }

  const hasLink = source?.url || source?.ecli

  return (
    <button
      onClick={hasLink ? handleClick : undefined}
      className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm underline decoration-dotted decoration-gray-400 hover:decoration-gray-600 underline-offset-2 cursor-pointer transition-colors"
      title={tooltipTitle}
      type="button"
    >
      <span className="truncate max-w-[250px]">{displayName}</span>
      {hasLink && <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />}
    </button>
  )
}

interface CustomMarkdownComponentsProps {
  onPdfClick: (
    filename: string,
    pageNumber?: number,
    highlightContent?: string
  ) => void
  documentChunks?: Array<{
    documentName?: string
    documentId?: string
    pageNumber?: number
    content?: string
    metadata?: { title?: string; pageNumber?: number }
  }>
  // Sources from the agent for inline citation rendering
  sources?: SourceReference[]
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

  // Helper to get page number from document chunks
  const getPageFromDocNumber = (docNum: number): number | null => {
    if (
      !componentProps.documentChunks ||
      !componentProps.documentChunks[docNum - 1]
    ) {
      return null
    }
    const chunk = componentProps.documentChunks[docNum - 1]
    const pageNumber = chunk.pageNumber || chunk.metadata?.pageNumber || null

    if (pageNumber !== null && pageNumber !== undefined) {
      const parsedPage =
        typeof pageNumber === 'string'
          ? parseInt(pageNumber, 10)
          : Number(pageNumber)
      return isNaN(parsedPage) || parsedPage <= 0 ? null : parsedPage
    }
    return null
  }

  // Helper to find page number by filename
  const getPageFromFilename = (filename: string): number | null => {
    if (!componentProps.documentChunks) return null

    const chunk = componentProps.documentChunks.find(
      (chunk) =>
        chunk.documentName === filename || chunk.metadata?.title === filename
    )

    if (!chunk) return null

    const pageNumber = chunk.pageNumber || chunk.metadata?.pageNumber || null
    if (pageNumber !== null && pageNumber !== undefined) {
      const parsedPage =
        typeof pageNumber === 'string'
          ? parseInt(pageNumber, 10)
          : Number(pageNumber)
      return isNaN(parsedPage) || parsedPage <= 0 ? null : parsedPage
    }
    return null
  }

  // Helper to get content from document number for highlighting
  const getContentFromDocNumber = (docNum: number): string | null => {
    if (
      !componentProps.documentChunks ||
      !componentProps.documentChunks[docNum - 1]
    ) {
      return null
    }
    return componentProps.documentChunks[docNum - 1].content || null
  }

  // Helper to get content by filename for highlighting
  const getContentFromFilename = (filename: string): string | null => {
    if (!componentProps.documentChunks) return null

    const chunk = componentProps.documentChunks.find(
      (chunk) =>
        chunk.documentName === filename || chunk.metadata?.title === filename
    )

    return chunk?.content || null
  }

  // Helper to normalize source from database format to our SourceReference format
  const normalizeSource = (
    raw: Record<string, unknown>
  ): SourceReference | null => {
    if (!raw) return null

    // Get type from metadata.type or infer from fields
    let sourceType: 'rag' | 'jurisprudence' | 'legislation' = 'rag'
    const metadata = raw.metadata as Record<string, unknown> | undefined
    if (metadata?.type) {
      sourceType = metadata.type as 'rag' | 'jurisprudence' | 'legislation'
    } else if (raw.type) {
      sourceType = raw.type as 'rag' | 'jurisprudence' | 'legislation'
    } else if (
      raw.ecli ||
      (typeof raw.documentName === 'string' &&
        raw.documentName.includes('ECLI:'))
    ) {
      sourceType = 'jurisprudence'
    } else if (
      raw.numac ||
      raw.documentType === 'LOI' ||
      raw.documentType === 'ARRETE'
    ) {
      sourceType = 'legislation'
    }

    const documentName = raw.documentName as string | undefined
    const ecliMatch = documentName?.match(/ECLI:[^\s]+/)

    return {
      id: (raw.id || raw.documentId || '') as string,
      type: sourceType,
      title: (documentName || raw.title || 'Source') as string,
      url: (raw.documentUrl || raw.url) as string | undefined,
      excerpt: (raw.content || raw.excerpt) as string | undefined,
      ecli: (raw.ecli || ecliMatch?.[0]) as string | undefined,
      courtName: raw.courtName as string | undefined,
      decisionDate: raw.decisionDate as string | undefined,
      documentName: documentName,
      pageNumber: raw.pageNumber as number | undefined,
      numac: raw.numac as string | undefined,
      documentType: raw.documentType as string | undefined,
      publicationDate: raw.publicationDate as string | undefined,
    }
  }

  // Helper to find source by ID or by type+index
  const getSourceById = (sourceId: string): SourceReference | null => {
    if (!componentProps.sources || componentProps.sources.length === 0) {
      return null
    }

    // Parse the sourceId (e.g., "leg:1" -> type="leg", index=1)
    const match = sourceId.match(/^(rag|jur|leg):(\d+)$/i)
    if (!match) return null

    const typePrefix = match[1].toLowerCase()
    const index = parseInt(match[2], 10) - 1 // Convert to 0-based index

    // Map type prefix to source type
    const typeMap: Record<string, string> = {
      rag: 'rag',
      jur: 'jurisprudence',
      leg: 'legislation',
    }
    const targetType = typeMap[typePrefix]

    // Normalize all sources and filter by type
    const normalizedSources = componentProps.sources
      .map((s) => normalizeSource(s as unknown as Record<string, unknown>))
      .filter(Boolean) as SourceReference[]
    const sourcesOfType = normalizedSources.filter((s) => s.type === targetType)

    if (index >= 0 && index < sourcesOfType.length) {
      return sourcesOfType[index]
    }

    return null
  }

  // SHARED text processing function - handles all citation patterns
  const processTextContent = (
    text: string,
    keyPrefix: string = ''
  ): ReactNode[] => {
    // Match patterns:
    // 1. <filename.pdf>
    // 2. Document N
    // 3. ECLI:BE:...
    // 4. [#rag:1], [#jur:2], [#leg:1]
    const pattern =
      /(<[^>]+\.pdf>|Document \d+|ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9._-]+|\[#(?:rag|jur|leg):\d+\])/gi
    const parts = text.split(pattern)

    return parts.map((part, index) => {
      const key = `${keyPrefix}-${index}`

      // Check for inline citation [#source_id]
      const citationMatch = part.match(/^\[#((rag|jur|leg):(\d+))\]$/i)
      if (citationMatch) {
        const sourceId = citationMatch[1].toLowerCase()
        const sourceType = citationMatch[2].toLowerCase() as
          | 'rag'
          | 'jur'
          | 'leg'
        const sourceNumber = citationMatch[3]
        const source = getSourceById(sourceId)

        // Always show the badge, even if source not found (will show generic tooltip)
        return (
          <CitationBadge
            key={key}
            source={source}
            number={sourceNumber}
            sourceType={sourceType}
          />
        )
      }

      // Check for PDF reference <filename.pdf>
      const pdfMatch = part.match(/^<([^>]+\.pdf)>$/)
      if (pdfMatch) {
        const filename = pdfMatch[1]
        const pageNumber = getPageFromFilename(filename)
        const content = getContentFromFilename(filename)
        return (
          <PDFReference
            key={key}
            filename={filename}
            onClick={() =>
              componentProps.onPdfClick(
                filename,
                pageNumber || undefined,
                content || undefined
              )
            }
          />
        )
      }

      // Check for "Document N" reference
      const docMatch = part.match(/^Document (\d+)$/)
      if (docMatch) {
        const docNumber = parseInt(docMatch[1])
        const filename = getFilenameFromDocNumber(docNumber)
        const pageNumber = getPageFromDocNumber(docNumber)
        const content = getContentFromDocNumber(docNumber)

        if (filename) {
          return (
            <PDFReference
              key={key}
              filename={filename}
              onClick={() =>
                componentProps.onPdfClick(
                  filename,
                  pageNumber || undefined,
                  content || undefined
                )
              }
            />
          )
        }
      }

      // Check for ECLI reference
      const ecliMatch = part.match(
        /^(ECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9._-]+)$/i
      )
      if (ecliMatch) {
        const ecli = ecliMatch[1].toUpperCase()
        const juportalUrl = `https://juportal.be/content/${encodeURIComponent(ecli)}`
        return (
          <a
            key={key}
            href={juportalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 underline decoration-amber-400 hover:decoration-amber-600 font-medium"
            title={`Voir sur JuPortal: ${ecli}`}
          >
            {ecli}
            <ExternalLink className="h-3 w-3 inline-block" />
          </a>
        )
      }

      return part
    })
  }

  // Recursive function to process all children (handles nested elements)
  const processChildren = (
    children: ReactNode,
    keyPrefix: string = 'child'
  ): ReactNode => {
    return Children.map(children, (child, idx) => {
      // If it's a string, process it for citations
      if (typeof child === 'string') {
        const processed = processTextContent(child, `${keyPrefix}-${idx}`)
        // If nothing changed, return original string
        if (processed.length === 1 && processed[0] === child) {
          return child
        }
        return processed
      }

      // If it's a valid React element with children, recurse
      if (
        isValidElement<{ children?: ReactNode }>(child) &&
        child.props &&
        child.props.children
      ) {
        const childProps = child.props as { children?: ReactNode }
        return cloneElement(child, {
          children: processChildren(childProps.children, `${keyPrefix}-${idx}`),
        })
      }

      return child
    })
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  return {
    // Headings with proper styling
    h1: (props: any) => (
      <h1
        className="text-2xl font-bold mt-6 mb-4 text-gray-900 border-b pb-2"
        {...props}
      >
        {processChildren(props.children, 'h1')}
      </h1>
    ),
    h2: (props: any) => (
      <h2 className="text-xl font-bold mt-5 mb-3 text-gray-900" {...props}>
        {processChildren(props.children, 'h2')}
      </h2>
    ),
    h3: (props: any) => (
      <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-900" {...props}>
        {processChildren(props.children, 'h3')}
      </h3>
    ),
    h4: (props: any) => (
      <h4
        className="text-base font-semibold mt-3 mb-2 text-gray-800"
        {...props}
      >
        {processChildren(props.children, 'h4')}
      </h4>
    ),

    // Paragraphs
    p: (props: any) => {
      const { children, ...htmlProps } = props
      return (
        <p
          className="mb-4 text-gray-700 leading-relaxed break-words"
          {...htmlProps}
        >
          {processChildren(children, 'p')}
        </p>
      )
    },

    // Tables
    table: (props: any) => (
      <div className="my-4 w-full overflow-x-auto">
        <table
          className="min-w-full divide-y divide-gray-300 border border-gray-200"
          {...props}
        />
      </div>
    ),
    thead: (props: any) => <thead className="bg-gray-50" {...props} />,
    tbody: (props: any) => (
      <tbody className="divide-y divide-gray-200 bg-white" {...props} />
    ),
    tr: (props: any) => <tr {...props} />,
    th: (props: any) => (
      <th
        className="px-3 py-2 text-left text-sm font-semibold text-gray-900"
        {...props}
      >
        {processChildren(props.children, 'th')}
      </th>
    ),
    td: (props: any) => (
      <td className="px-3 py-2 text-sm text-gray-700" {...props}>
        {processChildren(props.children, 'td')}
      </td>
    ),

    // Text formatting
    strong: (props: any) => (
      <strong className="font-bold text-gray-900">
        {processChildren(props.children, 'strong')}
      </strong>
    ),

    // Emphasis
    em: (props: any) => (
      <em className="italic text-gray-700">
        {processChildren(props.children, 'em')}
      </em>
    ),

    // Lists
    ul: (props: any) => (
      <ul
        className="list-disc list-inside my-4 space-y-2 break-words"
        {...props}
      />
    ),
    ol: (props: any) => (
      <ol
        className="list-decimal list-inside my-4 space-y-2 break-words"
        {...props}
      />
    ),
    li: (props: any) => (
      <li className="text-gray-700 break-words">
        {processChildren(props.children, 'li')}
      </li>
    ),

    // Blockquotes
    blockquote: (props: any) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 py-2 mb-4 italic bg-gray-50 text-gray-700 break-words">
        {processChildren(props.children, 'blockquote')}
      </blockquote>
    ),

    // Horizontal rules
    hr: (props: any) => (
      <hr className="my-6 border-t border-gray-300" {...props} />
    ),

    // Links
    a: (props: any) => (
      <a
        {...props}
        className="text-blue-600 hover:text-blue-800 underline break-words"
        target="_blank"
        rel="noopener noreferrer"
      />
    ),

    // Code - handle inline code with potential citations
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
          const pageNumber = getPageFromFilename(filename)
          const content = getContentFromFilename(filename)
          return (
            <PDFReference
              filename={filename}
              onClick={() =>
                componentProps.onPdfClick(
                  filename,
                  pageNumber || undefined,
                  content || undefined
                )
              }
            />
          )
        }
      }

      return (
        <code
          className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono break-all"
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
