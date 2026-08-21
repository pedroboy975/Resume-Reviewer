/**
 * Abertura de PDF no browser.
 *
 * Não há worker próprio aqui: o `pdfjs-dist` já faz o parsing dentro do
 * worker dele, e a reconstrução de layout em `layout.ts` custa milissegundos.
 * Um worker nosso em volta seria só uma camada a mais para manter.
 * Ver CLAUDE.md > "Nada pesado na main thread".
 */

import { extractPages } from './pdf';
import { documentToText, type Page } from './layout';

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

/** Páginas com posições, a partir do arquivo escolhido pelo usuário. */
export async function readPdf(file: File): Promise<Page[]> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  return extractPages(doc as never);
}

/** Atalho: arquivo → texto em ordem de leitura. */
export async function readPdfText(file: File): Promise<string> {
  return documentToText(await readPdf(file));
}
