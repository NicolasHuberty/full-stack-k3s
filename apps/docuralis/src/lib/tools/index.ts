/**
 * Belgian Law Tools Module
 *
 * Exports all tools for searching Belgian jurisprudence:
 * - JUPORTAL web search (live search on juportal.be)
 * - Qdrant RAG search (semantic search in vector database)
 * - Tool executor with MCP-style logging
 */

// Types
export * from './types'

// JUPORTAL Tool
export {
  juportalSearchToolDefinition,
  executeJuportalSearch,
  getAvailableCourts,
} from './juportal'

// Jurisprudence RAG Tool
export {
  jurisprudenceRagToolDefinition,
  executeJurisprudenceRagSearch,
  searchCollectionJurisprudence,
  getJurisprudenceStats,
} from './jurisprudence-rag'

// Tool Executor
export {
  executeTool,
  executeToolsParallel,
  getToolCallHistory,
  clearToolCallHistory,
  getToolDefinitions,
  formatToolCallsForDisplay,
  onToolCall,
  toolEvents,
  AVAILABLE_TOOLS,
} from './executor'
