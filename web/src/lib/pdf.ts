import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function renderPages(
  data: ArrayBuffer,
  cssWidth: number,
): Promise<HTMLCanvasElement[]> {
  const pdf = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const dpr = window.devicePixelRatio || 1;
  const canvases: HTMLCanvasElement[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const scale = (cssWidth / page.getViewport({ scale: 1 }).width) * dpr;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    await page.render({ canvas, viewport }).promise;
    canvases.push(canvas);
  }
  return canvases;
}
