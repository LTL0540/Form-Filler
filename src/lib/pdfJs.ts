import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

export type PdfDocument = PDFDocumentProxy;
export type PdfPage = PDFPageProxy;

export async function loadPdfDocument(file: File): Promise<PdfDocument> {
  const buffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
}

export async function getPdfPage(
  pdfDocument: PdfDocument,
  pageNumber: number,
): Promise<PdfPage> {
  return pdfDocument.getPage(pageNumber);
}
