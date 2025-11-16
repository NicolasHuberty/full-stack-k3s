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
  language?: string | null;
  duration?: number | null;
}

/**
 * Transcribe audio file using Mistral Voxtral
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options?: {
    filename?: string;
    language?: string;
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
      duration: (response as any).duration,
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
    // Fetch the audio from URL
    const response = await fetch(audioUrl);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Use the main transcribe function
    return transcribeAudio(audioBuffer, options);
  } catch (error) {
    console.error("Mistral transcription error:", error);
    throw new Error(
      `Transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Process and structure text content with AI
 */
export async function processTextWithAI(
  content: string,
  options?: {
    task?: "summarize" | "structure" | "improve";
  },
): Promise<string> {
  const task = options?.task || "structure";

  const prompts = {
    summarize: `Tu es un assistant qui aide à résumer et organiser des notes professionnelles. Analyse le texte suivant et génère un résumé structuré et professionnel en français.

Format attendu:
# Titre (génère un titre pertinent)

## Résumé
[Résumé en 2-3 phrases]

## Points clés
- Point 1
- Point 2
...

## Détails
[Détails organisés par sections si nécessaire]

Texte à traiter:
${content}`,

    structure: `Tu es un assistant professionnel qui transforme des notes brutes en documents d'entreprise prêts à être envoyés aux clients.

RÈGLES IMPÉRATIVES:
1. NE JAMAIS inclure de phrases d'introduction comme "Voici le document...", "Voici une version...", etc.
2. NE JAMAIS faire référence à la tâche ou aux consignes
3. Commencer DIRECTEMENT par le titre du document
4. Le document doit être immédiatement utilisable par le client
5. N'utilise PAS de markdown - uniquement du texte brut avec:
   - Titres en MAJUSCULES
   - Lignes vides entre sections
   - Tirets (-) pour les listes
   - Numéros (1., 2., 3.) pour les listes ordonnées

FORMAT ATTENDU:
[TITRE DU DOCUMENT EN MAJUSCULES]
[Date si pertinent]

[SECTIONS ET CONTENU...]

Texte à transformer:
${content}`,

    improve: `Tu es un assistant qui aide à améliorer la rédaction de notes professionnelles. Améliore le texte suivant en:
- Corrigeant les fautes
- Améliorant la clarté
- Structurant les informations
- Gardant le sens original

Texte à traiter:
${content}`,
  };

  try {
    const response = await mistralClient.chat.complete({
      model: "mistral-small-latest",
      messages: [
        {
          role: "user",
          content: prompts[task],
        },
      ],
    });

    const processedText = response.choices?.[0]?.message?.content || content;
    return typeof processedText === "string" ? processedText : content;
  } catch (error) {
    console.error("Mistral AI processing error:", error);
    // Return original content if AI processing fails
    return content;
  }
}

export { mistralClient };
