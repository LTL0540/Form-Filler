import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { DEFAULT_FONT_SIZE, DEFAULT_LINE_HEIGHT } from './mapping';
import { loadPdfDocument } from './pdfJs';
import type { Field } from '../types/field';

type FieldValues = Record<string, string>;
const RASTER_SCALE = 2;

export async function flattenPdf(pdfFile: File): Promise<Uint8Array> {
  const outputDocument = await createRasterizedOutputDocument(pdfFile);
  return outputDocument.save();
}

export async function fillPdf(
  pdfFile: File,
  fields: Field[],
  values: FieldValues,
): Promise<Uint8Array> {
  const outputDocument = await createRasterizedOutputDocument(pdfFile);
  const font = await outputDocument.embedFont(StandardFonts.Helvetica);
  const pageCount = outputDocument.getPageCount();

  for (const field of fields) {
    const value = values[field.key] ?? '';
    if (!value.trim()) continue;

    if (field.page < 1 || field.page > pageCount) {
      throw new Error(
        `Field "${field.label}" points to page ${field.page}, but this PDF has ${pageCount} page${pageCount === 1 ? '' : 's'}.`,
      );
    }

    const page = outputDocument.getPage(field.page - 1);
    const { height: pageHeight } = page.getSize();

    /*
      pdf.js renders pages into a browser canvas whose origin is top-left.
      pdf-lib writes into PDF user space, whose origin is bottom-left.

      The builder stores field boxes in unscaled PDF page units, but keeps the
      pdf.js top-left orientation because that matches what users drag on screen.
      To draw the text with pdf-lib, x stays the same and y is flipped by taking
      the page height minus the top edge plus the field height.
    */
    const pdfX = field.x;
    const pdfY = pageHeight - field.y - field.height;
    const fontSize = field.fontSize ?? DEFAULT_FONT_SIZE;
    const lineHeight = fontSize * (field.lineHeight ?? DEFAULT_LINE_HEIGHT);

    page.drawText(value, {
      x: pdfX + 2,
      y: pdfY + field.height - fontSize - 2,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      lineHeight,
    });
  }

  return outputDocument.save();
}

async function createRasterizedOutputDocument(pdfFile: File) {
  const sourceDocument = await loadPdfDocument(pdfFile);
  const outputDocument = await PDFDocument.create();

  for (let pageNumber = 1; pageNumber <= sourceDocument.numPages; pageNumber += 1) {
    const sourcePage = await sourceDocument.getPage(pageNumber);
    const pageViewport = sourcePage.getViewport({ scale: 1 });
    const renderViewport = sourcePage.getViewport({ scale: RASTER_SCALE });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create a canvas for PDF flattening.');

    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;

    const renderTask = sourcePage.render({
      canvas,
      canvasContext: context,
      viewport: renderViewport,
    });
    await renderTask.promise;

    const pngBytes = await canvasToPngBytes(canvas);
    const embeddedPageImage = await outputDocument.embedPng(pngBytes);
    const outputPage = outputDocument.addPage([pageViewport.width, pageViewport.height]);

    outputPage.drawImage(embeddedPageImage, {
      x: 0,
      y: 0,
      width: pageViewport.width,
      height: pageViewport.height,
    });

    canvas.width = 0;
    canvas.height = 0;
  }

  return outputDocument;
}

async function canvasToPngBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) throw new Error('Could not render a flattened PDF page.');
  return new Uint8Array(await blob.arrayBuffer());
}
