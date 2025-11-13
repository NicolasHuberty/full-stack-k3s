import { StateGraph, END, START } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import type { AgentState, DocumentChunk } from "./types";
import {
  decomposeQuery,
  retrieveDocuments,
  gradeDocumentsClassical,
  gradeDocumentsReflexion,
  generateResponse,
  translateQuery,
} from "./nodes";

export function createAgentGraph() {
  const workflow = new StateGraph<AgentState>({
    channels: {
      query: null,
      userId: null,
      collectionId: null,
      sessionId: null,
      reflexion: null,
      multilingual: null,
      translatorMode: null,
      smartMode: null,
      subQueries: null,
      retrievedDocs: null,
      relevantDocs: null,
      answer: null,
      error: null,
      inputTokens: null,
      outputTokens: null,
    },
  });

  // Add nodes
  workflow.addNode("decompose", decomposeQuery);
  workflow.addNode("retrieve", retrieveDocuments);
  workflow.addNode("gradeClassical", gradeDocumentsClassical);
  workflow.addNode("gradeReflexion", gradeDocumentsReflexion);
  workflow.addNode("generate", generateResponse);

  // Add conditional edge from START
  workflow.addConditionalEdges(START, (state: AgentState) => {
    if (state.smartMode || state.reflexion) {
      return "decompose";
    }
    return "retrieve";
  });

  // From decompose, always go to retrieve
  workflow.addEdge("decompose", "retrieve");

  // From retrieve, route to appropriate grading
  workflow.addConditionalEdges("retrieve", (state: AgentState) => {
    if (state.smartMode || state.reflexion) {
      return "gradeReflexion";
    }
    return "gradeClassical";
  });

  // Both grading nodes go to generate
  workflow.addEdge("gradeClassical", "generate");
  workflow.addEdge("gradeReflexion", "generate");

  // Generate goes to END
  workflow.addEdge("generate", END);

  return workflow.compile();
}
