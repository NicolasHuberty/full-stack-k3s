import { Mistral } from "@mistralai/mistralai";

// Initialize Mistral client
const mistralClient = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY || "",
});

export interface TranscriptionResult {
  text: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
  language?: string;
  duration?: number;
}

/**
 * Transcribe audio file using Mistral Voxtral
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options?: {
    filename?: string;
    language?: string;
    timestampGranularities?: "segment";
  },
): Promise<TranscriptionResult> {
  try {
    const response = await mistralClient.audio.transcriptions.complete({
      model: "voxtral-mini-latest",
      file: {
        fileName: options?.filename || "audio.webm",
        content: audioBuffer,
      },
      language: options?.language,
      timestampGranularities: options?.timestampGranularities
        ? [options.timestampGranularities]
        : undefined,
    });

    return {
      text: response.text,
      segments: response.segments?.map((seg: any) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
      language: response.language ?? undefined,
    };
  } catch (error) {
    console.error("Mistral transcription error:", error);
    throw new Error(
      `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Transcribe audio from URL
 */
export async function transcribeAudioFromUrl(
  audioUrl: string,
  options?: {
    filename?: string;
    language?: string;
    timestampGranularities?: "segment";
  },
): Promise<TranscriptionResult> {
  try {
    // Fetch the audio data from the URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(
        `Failed to fetch audio from URL: ${audioResponse.statusText}`,
      );
    }

    // Convert to ArrayBuffer
    const arrayBuffer = await audioResponse.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    const response = await mistralClient.audio.transcriptions.complete({
      model: "voxtral-mini-latest",
      file: {
        fileName: options?.filename || "audio.webm",
        content: audioBuffer,
      },
      language: options?.language,
      timestampGranularities: options?.timestampGranularities
        ? [options.timestampGranularities]
        : undefined,
    });

    return {
      text: response.text,
      segments: response.segments?.map((seg: any) => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text,
      })),
      language: response.language ?? undefined,
    };
  } catch (error) {
    console.error("Mistral transcription error:", error);
    throw new Error(
      `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Analyze transcription to understand user intent and extract structured information
 */
export async function analyzeTranscriptionIntent(
  transcriptionText: string,
): Promise<{
  intent: string;
  userRequest?: string;
  structuredData?: any;
  shouldGenerateDocument: boolean;
  documentType?: string;
  sections?: Array<{ title: string; content: string }>;
}> {
  try {
    const systemPrompt = `You are an AI assistant that analyzes voice transcriptions to understand what the user wants to accomplish.

Your task:
1. Identify if the user is requesting a document to be created
2. Extract the type of document (Word/DOCX, PDF, presentation, report, etc.)
3. Identify the structure requested (sections, bullet points, etc.)
4. Extract and reorganize the content according to user's request
5. Improve and rewrite the content professionally while keeping the original meaning
6. CRITICAL: Write the document in the SAME LANGUAGE as the transcription (French→French, English→English, etc.)
7. Create a COMPLETE, USER-READY document (not a copy of the transcription)

Respond in JSON format with:
{
  "intent": "brief description of what user wants",
  "userRequest": "title for the document in the source language",
  "shouldGenerateDocument": true/false,
  "documentType": "docx|pdf|txt|presentation|etc",
  "sections": [
    {
      "title": "Section name in source language",
      "content": "Professionally written content as bullet points (one per line with • prefix) or paragraphs. Write in the SAME language as the transcription. Make it user-ready, not a transcription copy."
    }
  ]
}

Example for French transcription requesting bullet points:
- Generate bullet points as: "• Point un\n• Point deux\n• Point trois"
- Each bullet point on a new line with • prefix
- Write everything in French

If the user is just recording thoughts without requesting a document, set shouldGenerateDocument to false.`;

    const response = await mistralClient.chat.complete({
      model: "mistral-large-latest",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analyze this transcription and extract the user's intent:\n\n${transcriptionText}`,
        },
      ],
      responseFormat: { type: "json_object" },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No response from Mistral");
    }

    const contentStr =
      typeof content === "string" ? content : JSON.stringify(content);
    const analysis = JSON.parse(contentStr);
    return analysis;
  } catch (error) {
    console.error("Mistral intent analysis error:", error);
    throw new Error(
      `Intent analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export { mistralClient };
