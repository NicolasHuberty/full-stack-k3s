import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import PDFDocument from "pdfkit";
import type { TranscriptionResult } from "./mistral";

export type DocumentFormat = "txt" | "pdf" | "docx";

export interface GenerateDocumentOptions {
  title: string;
  transcription: TranscriptionResult;
  format: DocumentFormat;
  includeTimestamps?: boolean;
  metadata?: {
    memoTitle?: string;
    createdAt?: Date;
    duration?: number;
  };
}

/**
 * Generate document from transcription
 */
export async function generateDocument(
  options: GenerateDocumentOptions,
): Promise<Buffer> {
  switch (options.format) {
    case "txt":
      return generateTextDocument(options);
    case "pdf":
      return generatePdfDocument(options);
    case "docx":
      return generateDocxDocument(options);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

/**
 * Generate plain text document
 */
function generateTextDocument(options: GenerateDocumentOptions): Buffer {
  const { title, transcription, includeTimestamps, metadata } = options;

  let content = "";

  // Header
  content += `${title}\n`;
  content += `${"=".repeat(title.length)}\n\n`;

  // Metadata
  if (metadata?.memoTitle) {
    content += `Memo: ${metadata.memoTitle}\n`;
  }
  if (metadata?.createdAt) {
    content += `Date: ${metadata.createdAt.toLocaleString()}\n`;
  }
  if (transcription.language) {
    content += `Language: ${transcription.language}\n`;
  }
  if (transcription.duration) {
    content += `Duration: ${Math.round(transcription.duration)}s\n`;
  }
  content += "\n";

  // Full transcription
  content += "Transcription:\n";
  content += `${"-".repeat(50)}\n\n`;
  content += `${transcription.text}\n\n`;

  // Timestamps (if available and requested)
  if (includeTimestamps && transcription.segments?.length) {
    content += "\nTimestamped Segments:\n";
    content += `${"-".repeat(50)}\n\n`;

    for (const segment of transcription.segments) {
      const start = formatTime(segment.start);
      const end = formatTime(segment.end);
      content += `[${start} - ${end}] ${segment.text}\n\n`;
    }
  }

  return Buffer.from(content, "utf-8");
}

/**
 * Generate PDF document
 */
function generatePdfDocument(
  options: GenerateDocumentOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const { title, transcription, includeTimestamps, metadata } = options;

    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title
    doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown();

    // Metadata
    doc.fontSize(10).font("Helvetica");
    if (metadata?.memoTitle) {
      doc.text(`Memo: ${metadata.memoTitle}`);
    }
    if (metadata?.createdAt) {
      doc.text(`Date: ${metadata.createdAt.toLocaleString()}`);
    }
    if (transcription.language) {
      doc.text(`Language: ${transcription.language}`);
    }
    if (transcription.duration) {
      doc.text(`Duration: ${Math.round(transcription.duration)}s`);
    }
    doc.moveDown();

    // Transcription
    doc.fontSize(14).font("Helvetica-Bold").text("Transcription:");
    doc.moveDown(0.5);
    doc.fontSize(11).font("Helvetica").text(transcription.text, {
      align: "justify",
    });
    doc.moveDown();

    // Timestamps
    if (includeTimestamps && transcription.segments?.length) {
      doc.addPage();
      doc.fontSize(14).font("Helvetica-Bold").text("Timestamped Segments:");
      doc.moveDown(0.5);

      for (const segment of transcription.segments) {
        const start = formatTime(segment.start);
        const end = formatTime(segment.end);

        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .fillColor("#666666")
          .text(`[${start} - ${end}]`, { continued: true })
          .font("Helvetica")
          .fillColor("#000000")
          .text(` ${segment.text}`);

        doc.moveDown(0.3);
      }
    }

    doc.end();
  });
}

/**
 * Generate DOCX document
 */
async function generateDocxDocument(
  options: GenerateDocumentOptions,
): Promise<Buffer> {
  const { title, transcription, includeTimestamps, metadata } = options;

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: title,
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
    }),
  );

  children.push(new Paragraph({ text: "" })); // Empty line

  // Metadata
  if (metadata?.memoTitle) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Memo: ", bold: true }),
          new TextRun({ text: metadata.memoTitle }),
        ],
      }),
    );
  }
  if (metadata?.createdAt) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Date: ", bold: true }),
          new TextRun({ text: metadata.createdAt.toLocaleString() }),
        ],
      }),
    );
  }
  if (transcription.language) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Language: ", bold: true }),
          new TextRun({ text: transcription.language }),
        ],
      }),
    );
  }
  if (transcription.duration) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Duration: ", bold: true }),
          new TextRun({ text: `${Math.round(transcription.duration)}s` }),
        ],
      }),
    );
  }

  children.push(new Paragraph({ text: "" })); // Empty line

  // Transcription
  children.push(
    new Paragraph({
      text: "Transcription:",
      heading: HeadingLevel.HEADING_2,
    }),
  );

  children.push(
    new Paragraph({
      text: transcription.text,
      alignment: AlignmentType.JUSTIFIED,
    }),
  );

  children.push(new Paragraph({ text: "" })); // Empty line

  // Timestamps
  if (includeTimestamps && transcription.segments?.length) {
    children.push(
      new Paragraph({
        text: "Timestamped Segments:",
        heading: HeadingLevel.HEADING_2,
      }),
    );

    for (const segment of transcription.segments) {
      const start = formatTime(segment.start);
      const end = formatTime(segment.end);

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${start} - ${end}] `,
              bold: true,
              color: "666666",
            }),
            new TextRun({ text: segment.text }),
          ],
        }),
      );
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  // Convert to buffer using docx Packer
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
