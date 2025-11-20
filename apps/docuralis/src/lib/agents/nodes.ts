import { ChatOpenAI } from '@langchain/openai'
import type {
  AgentState,
  DocumentChunk,
  GradingResult,
  ReflexionGradingResult,
} from './types'
import {
  DECOMPOSE_QUERY_PROMPT,
  BINARY_GRADING_SYSTEM_PROMPT,
  BINARY_GRADING_PROMPT,
  REFLEXION_GRADING_SYSTEM_PROMPT,
  REFLEXION_GRADING_PROMPT,
  FINAL_RESPONSE_SYSTEM_PROMPT,
  FINAL_RESPONSE_PROMPT,
  TRANSLATE_QUERY_SYSTEM_PROMPT,
  TRANSLATE_QUERY_PROMPT,
} from './prompts'
import { searchDocuments } from '../rag/service'

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
})

export async function decomposeQuery(
  state: AgentState
): Promise<Partial<AgentState>> {
  try {
    const prompt = DECOMPOSE_QUERY_PROMPT.replace('{query}', state.query)

    const response = await model.invoke([
      {
        role: 'user',
        content: 'You are an expert at breaking down complex queries.',
      },
      { role: 'user', content: prompt },
    ])

    const subQueries = response.content
      .toString()
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    return {
      subQueries,
    }
  } catch (error) {
    console.error('Error decomposing query:', error)
    return {
      subQueries: [state.query],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function retrieveDocuments(
  state: AgentState
): Promise<Partial<AgentState>> {
  try {
    const allDocs: DocumentChunk[] = []
    const queriesToSearch = state.subQueries || [state.query]

    // Determine number of docs per query based on mode
    const docsPerQuery = state.smartMode || state.reflexion ? 30 : 10

    for (const query of queriesToSearch) {
      // Retrieve French documents
      const frenchDocs = await searchDocuments(
        state.collectionId,
        query,
        docsPerQuery
      )
      allDocs.push(...frenchDocs)

      // If multilingual or translator mode, retrieve Dutch documents
      if (state.multilingual || state.translatorMode) {
        const translatedQuery = await translateQuery(
          query,
          'Nederlands (Dutch)'
        )
        const dutchDocs = await searchDocuments(
          state.collectionId,
          translatedQuery,
          state.smartMode || state.reflexion ? 20 : 10
        )
        allDocs.push(...dutchDocs)
      }
    }

    // Deduplicate by content and title+page
    const seen = new Set<string>()
    const seenTitlePage = new Set<string>()
    const uniqueDocs: DocumentChunk[] = []

    for (const doc of allDocs) {
      const contentKey = doc.pageContent
      const titlePageKey = `${doc.metadata.title}:${doc.metadata.pageNumber}`

      if (!seen.has(contentKey) && !seenTitlePage.has(titlePageKey)) {
        seen.add(contentKey)
        seenTitlePage.add(titlePageKey)
        uniqueDocs.push(doc)
      }
    }
    return {
      retrievedDocs: uniqueDocs,
    }
  } catch (error) {
    console.error('Error retrieving documents:', error)
    return {
      retrievedDocs: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function gradeDocumentsClassical(
  state: AgentState
): Promise<Partial<AgentState>> {
  try {
    const relevantDocs: DocumentChunk[] = []

    for (const doc of state.retrievedDocs) {
      const prompt = BINARY_GRADING_PROMPT.replace(
        '{systemMessage}',
        BINARY_GRADING_SYSTEM_PROMPT
      )
        .replace('{document}', doc.pageContent)
        .replace('{question}', state.query)

      const response = await model.invoke([{ role: 'user', content: prompt }])

      try {
        const result = JSON.parse(response.content.toString()) as GradingResult

        if (result.pertinence === 'oui') {
          relevantDocs.push({
            ...doc,
            metadata: {
              ...doc.metadata,
              justification: result.justification,
            },
          })
        }
      } catch (parseError) {
        console.error('Error parsing grading result:', parseError)
      }
    }

    // Fallback: if no relevant docs, use first document
    if (relevantDocs.length === 0 && state.retrievedDocs.length > 0) {
      relevantDocs.push(state.retrievedDocs[0])
    }

    return {
      relevantDocs,
    }
  } catch (error) {
    console.error('Error grading documents:', error)
    return {
      relevantDocs: state.retrievedDocs.slice(0, 1), // Fallback to first doc
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function gradeDocumentsReflexion(
  state: AgentState
): Promise<Partial<AgentState>> {
  try {
    // Grade all documents in parallel for speed
    const gradingPromises = state.retrievedDocs.map(async (doc) => {
      try {
        const prompt = REFLEXION_GRADING_PROMPT.replace(
          '{systemMessage}',
          REFLEXION_GRADING_SYSTEM_PROMPT
        )
          .replace('{content}', doc.pageContent)
          .replace('{question}', state.query)

        const response = await model.invoke([{ role: 'user', content: prompt }])

        // Extract JSON from markdown code blocks if present
        let jsonString = response.content.toString().trim()

        try {
          // Remove markdown code blocks (```json ... ``` or ``` ... ```)
          const codeBlockMatch = jsonString.match(
            /```(?:json)?\s*([\s\S]*?)\s*```/
          )
          if (codeBlockMatch) {
            jsonString = codeBlockMatch[1].trim()
          }

          const result = JSON.parse(jsonString) as ReflexionGradingResult

          // Validate score is a number between 1-10
          if (
            typeof result.pertinenceScore !== 'number' ||
            result.pertinenceScore < 1 ||
            result.pertinenceScore > 10
          ) {
            console.warn(
              `Invalid pertinence score: ${result.pertinenceScore} for doc`
            )
            return null
          }

          // Accept any score >= 1 (very inclusive)
          // We'll filter and sort later
          return {
            ...doc,
            score: result.pertinenceScore,
            metadata: {
              ...doc.metadata,
              pertinenceScore: result.pertinenceScore,
              justification: result.justification,
            },
          }
        } catch (parseError) {
          console.error(
            'Error parsing reflexion grading result:',
            parseError,
            'Response:',
            jsonString?.substring(0, 200)
          )
          return null
        }
      } catch (error) {
        console.error('Error in reflexion grading:', error)
        return null
      }
    })

    // Wait for all grading to complete in parallel
    const results = await Promise.all(gradingPromises)
    const scoredDocs = results.filter((doc) => doc !== null) as Array<
      DocumentChunk & { score: number }
    >

    if (scoredDocs.length > 0) {
      const scores = scoredDocs.map((d) => d.score)
      // Filter by threshold >= 2
      const passedThreshold = scoredDocs.filter((d) => d.score >= 2)

      // If enough docs passed threshold, use them
      if (passedThreshold.length >= 10) {
        // Sort by score descending and take top 30
        passedThreshold.sort((a, b) => b.score - a.score)
        const relevantDocs = passedThreshold.slice(0, 30)

        return {
          relevantDocs,
        }
      } else {
        // Fallback: If not enough passed threshold, take top 30 by score regardless
        scoredDocs.sort((a, b) => b.score - a.score)
        const relevantDocs = scoredDocs.slice(0, 30)

        return {
          relevantDocs,
        }
      }
    }

    // Final fallback: use vector similarity scores if grading completely failed
    const docsWithSimilarity = state.retrievedDocs
      .map((doc) => ({
        ...doc,
        score: doc.metadata.similarity || 0,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)

    return {
      relevantDocs: docsWithSimilarity,
    }
  } catch (error) {
    console.error('Error grading documents (reflexion):', error)
    return {
      relevantDocs: state.retrievedDocs.slice(0, 1),
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function generateResponse(
  state: AgentState
): Promise<Partial<AgentState>> {
  try {
    // Format documents with filenames for proper citation
    const formattedDocs = state.relevantDocs
      .map((doc, idx) => {
        const justification = doc.metadata.justification || ''
        const filename = doc.metadata.title || `document_${idx + 1}.pdf`
        return `**${filename} (Page ${doc.metadata.pageNumber})**\n${justification ? `Justification: ${justification}\n` : ''}Contenu: ${doc.pageContent}`
      })
      .join('\n\n---\n\n')

    const prompt = FINAL_RESPONSE_PROMPT.replace(
      '{documents}',
      formattedDocs
    ).replace('{question}', state.query)

    const response = await model.invoke([
      { role: 'system', content: FINAL_RESPONSE_SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ])

    let answer = response.content.toString().trim()

    // Clean up code blocks if present
    if (answer.startsWith('```') && answer.endsWith('```')) {
      const lines = answer.split('\n')
      if (lines.length > 2) {
        answer = lines.slice(1, -1).join('\n')
      }
    } else if (answer.startsWith('```')) {
      answer = answer
        .replace(/```markdown/g, '')
        .replace(/```/g, '')
        .trim()
    }

    return {
      answer,
    }
  } catch (error) {
    console.error('Error generating response:', error)
    return {
      answer:
        "Désolé, une erreur s'est produite lors de la génération de la réponse.",
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

export async function translateQuery(
  query: string,
  targetLang: string
): Promise<string> {
  try {
    const systemPrompt = TRANSLATE_QUERY_SYSTEM_PROMPT.replace(
      '{targetLang}',
      targetLang
    )
    const userPrompt = TRANSLATE_QUERY_PROMPT.replace('{query}', query)

    const response = await model.invoke([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ])

    return response.content.toString().trim()
  } catch (error) {
    console.error('Error translating query:', error)
    return query // Fallback to original query
  }
}
