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
      language: response.language,
      duration: response.duration,
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
    const response = await mistralClient.audio.transcriptions.complete({
      model: "voxtral-mini-latest",
      file: {
        fileName: options?.filename || "audio.webm",
        content: audioUrl, // Can be URL or Buffer
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
      language: response.language,
      duration: response.duration,
    };
  } catch (error) {
    console.error("Mistral transcription error:", error);
    throw new Error(
      `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export { mistralClient };
