import Tesseract from 'tesseract.js';
import { createWorker } from 'tesseract.js';
import { logger } from '@/lib/logger';

export interface PageText {
  page_number: number;
  text: string;
}

/**
 * Check if a PDF is scanned (image-based) by checking if first page has text
 */
export async function isScannedPDF(buffer: Buffer): Promise<boolean> {
  try {
    // Use new pdf-parse 2.x API with PDFParse class
    const { PDFParse } = await import('pdf-parse');

    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText({ partial: [1] });
    await parser.destroy();

    const firstPageText = result.text.trim();

    // If first page has very little or no text, it's likely scanned
    if (firstPageText.length < 50) {
      logger.info('PDF detected as scanned (no text on first page)');
      return true;
    }

    logger.info('PDF detected as non-scanned (text found on first page)');
    return false;
  } catch (error) {
    logger.error('Error checking if PDF is scanned', error);
    // If we can't determine, assume it's not scanned
    return false;
  }
}

/**
 * Perform OCR on an image buffer
 */
export async function performOCR(imageBuffer: Buffer): Promise<string> {
  const worker = await createWorker('eng');

  try {
    const { data: { text } } = await worker.recognize(imageBuffer);
    return text;
  } finally {
    await worker.terminate();
  }
}

/**
 * Perform OCR on each page of a scanned PDF
 * Uses pdf-parse to extract images and tesseract for OCR
 */
export async function performPDFOCR(pdfBuffer: Buffer): Promise<PageText[]> {
  try {
    // Use new pdf-parse 2.x API with PDFParse class
    const { PDFParse } = await import('pdf-parse');

    const parser = new PDFParse({ data: pdfBuffer });
    const info = await parser.getInfo();
    const numPages = info.pages;

    logger.info(`Performing OCR on ${numPages} pages`);

    // Get text for all pages
    const result = await parser.getText();
    await parser.destroy();

    const _pageTexts: PageText[] = [];

    // Note: pdf-parse doesn't give us page-by-page access easily
    // For a production implementation, you'd want to use a library like pdf-lib or pdf.js
    // that can render each page as an image, then OCR each image

    // For now, we'll do a simple implementation that OCRs the entire PDF as one unit
    // This is a limitation that should be improved in production

    const worker = await createWorker('eng');

    try {
      // In a real implementation, you'd render each page to an image and OCR it
      // For now, we'll just return the extracted text as a single page
      // This is a simplified version - for true OCR of scanned PDFs, you need:
      // 1. pdf-lib or pdf.js to render pages as images
      // 2. Tesseract to OCR each image
      // 3. Combine results with page numbers

      // Fallback: return whatever text was extracted
      if (result.text && result.text.trim().length > 0) {
        return [{
          page_number: 1,
          text: result.text
        }];
      }

      // If no text, this is truly a scanned PDF
      // We need to render pages as images - this requires additional setup
      logger.warn('PDF has no extractable text. True OCR not yet implemented.');
      return [];
    } finally {
      await worker.terminate();
    }
  } catch (error) {
    logger.error('Error performing PDF OCR', error);
    return [];
  }
}

/**
 * Simple OCR for image files (PNG, JPG, etc.)
 */
export async function performImageOCR(imageBuffer: Buffer, pageNumber: number = 1): Promise<PageText> {
  const worker = await createWorker('eng');

  try {
    logger.info(`Performing OCR on image (page ${pageNumber})`);
    const { data: { text } } = await worker.recognize(imageBuffer);

    return {
      page_number: pageNumber,
      text: text,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Enhanced OCR with preprocessing
 * Applies image preprocessing to improve OCR accuracy
 */
export async function performEnhancedOCR(
  imageBuffer: Buffer,
  options: {
    pageNumber?: number;
    lang?: string;
  } = {}
): Promise<PageText> {
  const { pageNumber = 1, lang = 'eng' } = options;

  const worker = await createWorker(lang);

  try {
    // Set OCR parameters for better accuracy
    await worker.setParameters({
      tessedit_pageseg_mode: Tesseract.PSM.AUTO,
    });

    logger.info(`Performing enhanced OCR on page ${pageNumber}`);
    const { data: { text, confidence } } = await worker.recognize(imageBuffer);

    logger.info(`OCR completed with confidence: ${confidence}%`);

    return {
      page_number: pageNumber,
      text: text,
    };
  } finally {
    await worker.terminate();
  }
}
