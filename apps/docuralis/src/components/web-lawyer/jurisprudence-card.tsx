/**
 * Jurisprudence Card Component
 *
 * Displays a Belgian jurisprudence document with:
 * - ECLI identifier
 * - Court and date
 * - Summary
 * - Keywords
 * - Relevance score
 */

'use client'

import { cn } from '@/lib/utils'
import type { JurisprudenceDocument } from '@/hooks/use-web-lawyer'
import {
  Scale,
  Calendar,
  Hash,
  Tag,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useState } from 'react'

interface JurisprudenceCardProps {
  document: JurisprudenceDocument
  rank?: number
  className?: string
}

export function JurisprudenceCard({
  document,
  rank,
  className,
}: JurisprudenceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const scorePercent =
    document.score !== undefined ? Math.round(document.score * 100) : null

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* ECLI */}
          <div className="flex items-center gap-2">
            {rank && (
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                {rank}
              </span>
            )}
            <a
              href={document.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-mono text-primary hover:underline truncate"
            >
              {document.ecli}
            </a>
            <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          </div>

          {/* Court and Date */}
          <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Scale className="h-3.5 w-3.5" />
              {document.courtName}
            </span>
            {document.decisionDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {document.decisionDate}
              </span>
            )}
            {document.roleNumber && (
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" />
                {document.roleNumber}
              </span>
            )}
          </div>
        </div>

        {/* Score */}
        {scorePercent !== null && (
          <div
            className={cn(
              'flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium',
              scorePercent >= 80
                ? 'bg-green-100 text-green-700'
                : scorePercent >= 60
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
            )}
          >
            {scorePercent}% match
          </div>
        )}
      </div>

      {/* Summary */}
      {document.summary && (
        <div className="mt-3">
          <p
            className={cn(
              'text-sm text-foreground/80',
              !isExpanded && 'line-clamp-3'
            )}
          >
            {document.summary}
          </p>
          {document.summary.length > 200 && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-xs text-primary hover:underline flex items-center gap-1"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Voir moins
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Voir plus
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Keywords */}
      {document.thesaurusCas && document.thesaurusCas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {document.thesaurusCas
            .slice(0, isExpanded ? undefined : 5)
            .map((kw, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs"
              >
                <Tag className="h-3 w-3" />
                {kw}
              </span>
            ))}
          {!isExpanded && document.thesaurusCas.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{document.thesaurusCas.length - 5} more
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * List of jurisprudence documents
 */
interface JurisprudenceListProps {
  documents: JurisprudenceDocument[]
  className?: string
  maxItems?: number
}

export function JurisprudenceList({
  documents,
  className,
  maxItems,
}: JurisprudenceListProps) {
  const [showAll, setShowAll] = useState(false)

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Aucune jurisprudence trouvée
      </div>
    )
  }

  const displayedDocs =
    maxItems && !showAll ? documents.slice(0, maxItems) : documents
  const hasMore = maxItems && documents.length > maxItems

  return (
    <div className={cn('space-y-3', className)}>
      {displayedDocs.map((doc, idx) => (
        <JurisprudenceCard
          key={doc.ecli || idx}
          document={doc}
          rank={idx + 1}
        />
      ))}

      {hasMore && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-sm text-primary hover:underline"
        >
          Voir {documents.length - maxItems} autres résultats
        </button>
      )}
    </div>
  )
}

/**
 * Compact jurisprudence item for inline lists
 */
export function JurisprudenceInlineItem({
  document,
}: {
  document: JurisprudenceDocument
}) {
  return (
    <a
      href={document.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-2 rounded-md hover:bg-muted transition-colors"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-primary truncate">
          {document.ecli}
        </span>
        {document.score !== undefined && (
          <span className="text-xs text-muted-foreground">
            {Math.round(document.score * 100)}%
          </span>
        )}
      </div>
      <div className="text-xs text-muted-foreground truncate">
        {document.courtName} - {document.decisionDate}
      </div>
    </a>
  )
}
