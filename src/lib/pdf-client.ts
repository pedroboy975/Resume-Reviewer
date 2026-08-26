/**
 * Abertura de PDF no browser.
 *
 * Não há worker próprio aqui: o `pdfjs-dist` já faz o parsing dentro do
 * worker dele, e a reconstrução de layout em `layout.ts` custa milissegundos.
 * Um worker nosso em volta seria só uma camada a mais para manter.
 * Ver CLAUDE.md > "Nada pesado na main thread".
 */

import { extractPages, type OnProgress } from './pdf';
import { documentToText, type Page } from './layout';

/** Currículo real fica na casa de centenas de KB. Acima disso é caso patológico. */
const MAX_FILE_SIZE = 25 * 1024 * 1024;

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();
  return pdfjs;
}

/** Rejeita arquivo acima do teto antes de qualquer parsing. */
export function assertFileSize(file: Pick<File, 'size'>): void {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Arquivo maior que ${MAX_FILE_SIZE / (1024 * 1024)}MB — não é um currículo comum.`);
  }
}

/** Páginas com posições, a partir do arquivo escolhido pelo usuário. */
export async function readPdf(file: File, onProgress?: OnProgress): Promise<Page[]> {
  assertFileSize(file);
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  return extractPages(doc as never, onProgress);
}

/** Atalho: arquivo → texto em ordem de leitura. */
export async function readPdfText(file: File, onProgress?: OnProgress): Promise<string> {
  return documentToText(await readPdf(file, onProgress));
}
