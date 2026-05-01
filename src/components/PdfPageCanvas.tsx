import { useEffect, useRef, useState } from 'react';
import type { PdfDocument } from '../lib/pdfJs';

type PdfPageCanvasProps = {
  pdfDocument: PdfDocument | null;
  pageNumber: number;
  scale: number;
  onPageSize?: (size: { width: number; height: number }) => void;
  onCanvasRendered?: (canvas: HTMLCanvasElement) => void;
};

export function PdfPageCanvas({
  pdfDocument,
  pageNumber,
  scale,
  onPageSize,
  onCanvasRendered,
}: PdfPageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;

    async function renderPage() {
      if (!pdfDocument || !canvasRef.current) return;

      setIsRendering(true);
      const page = await pdfDocument.getPage(pageNumber);
      if (isCancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      onPageSize?.({ width: viewport.width, height: viewport.height });

      renderTask = page.render({ canvas, canvasContext: context, viewport });
      await renderTask.promise;
      if (!isCancelled) {
        setIsRendering(false);
        onCanvasRendered?.(canvas);
      }
    }

    renderPage().catch(() => {
      if (!isCancelled) setIsRendering(false);
    });

    return () => {
      isCancelled = true;
      renderTask?.cancel();
    };
  }, [onCanvasRendered, onPageSize, pageNumber, pdfDocument, scale]);

  return (
    <>
      {isRendering && <div className="render-badge">Rendering PDF</div>}
      <canvas ref={canvasRef} className="pdf-canvas" />
    </>
  );
}
