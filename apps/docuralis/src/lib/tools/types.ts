/**
 * Tool System Types for Belgian Law Agent
 *
 * MCP-style tool definitions with logging and visibility
 */

export type ToolStatus = 'pending' | 'running' | 'completed' | 'error'

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
  status: ToolStatus
  startedAt: Date
  completedAt?: Date
  result?: unknown
  error?: string
  durationMs?: number
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<
      string,
      {
        type: string
        description: string
        enum?: string[]
        default?: unknown
        items?: { type: string }
      }
    >
    required: string[]
  }
}

export interface ToolResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  metadata?: {
    durationMs: number
    source: string
    itemCount?: number
  }
}

export interface ToolExecutor {
  definition: ToolDefinition
  execute: (args: Record<string, unknown>) => Promise<ToolResult>
}

// Jurisprudence-specific types
export interface JurisprudenceDocument {
  ecli: string
  courtCode: string
  courtName: string
  decisionDate: string
  roleNumber: string
  summary: string
  thesaurusCas: string[]
  thesaurusUtu: string[]
  keywords: string[]
  consultationCount: number
  url: string
  iubelId: string
  language: string
  score?: number
}

export interface JurisprudenceSearchResult {
  query: string
  totalCount: number
  documents: JurisprudenceDocument[]
  fetchedAt: string
  source: 'qdrant' | 'juportal' | 'combined'
}

// Court codes mapping
export const BELGIAN_COURTS: Record<string, string> = {
  RVSCE: "Conseil d'État",
  GHCC: 'Cour constitutionnelle',
  CASS: 'Cour de cassation',
  CALIE: "Cour d'appel de Liège",
  CABRL: "Cour d'appel de Bruxelles",
  CAMON: "Cour d'appel de Mons",
  HBANT: "Cour d'appel d'Anvers",
  CTLIE: 'Cour du travail de Liège',
  CTBRL: 'Cour du travail de Bruxelles',
  CTMON: 'Cour du travail de Mons',
  AHANT: "Cour du travail d'Anvers",
  PIBRL: 'Tribunal de première instance de Bruxelles',
  PILIE: 'Tribunal de première instance de Liège',
  PILUX: 'Tribunal de première instance du Luxembourg',
  PINAM: 'Tribunal de première instance de Namur',
  PIHAI: 'Tribunal de première instance du Hainaut',
  TTBRL: 'Tribunal du travail de Bruxelles',
  TTLIE: 'Tribunal du travail de Liège',
  TTHAI: 'Tribunal du travail du Hainaut',
  TELIE: "Tribunal de l'entreprise de Liège",
  GBAPD: 'Autorité de protection des données',
  COPRIV: 'Commission protection vie privée',
  COHSAV: 'Commission aide aux victimes',
}
