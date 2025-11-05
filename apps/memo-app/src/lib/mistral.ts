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
      throw new Error(`Failed to fetch audio from URL: ${audioResponse.statusText}`);
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

export { mistralClient };
