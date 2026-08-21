/**
 * Adaptador entre `pdfjs-dist` e `layout.ts`.
 *
 * Não importa `pdfjs-dist`: recebe o documento já aberto, tipado
 * estruturalmente. É o que permite rodar a extração no browser (build normal)
 * e no teste (build legacy em Node) com o mesmo código.
 */

import { documentToText, type Page } from './layout';

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type PdfDocument = {
  numPages: number;
  getPage(n: number): Promise<{
    getViewport(params: { scale: number }): { width: number; height: number };
    getTextContent(): Promise<{ items: unknown[] }>;
  }>;
};

/** Chamado ao fim de cada página. Currículo longo demora o suficiente para importar. */
export type OnProgress = (done: number, total: number) => void;

/** Itens posicionados de uma página, em espaço PDF. */
export async function extractPages(doc: PdfDocument, onProgress?: OnProgress): Promise<Page[]> {
  const pages: Page[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = (content.items as PdfTextItem[])
      .filter((i) => typeof i.str === 'string' && Array.isArray(i.transform))
      .map((i) => ({
        str: i.str as string,
        x: (i.transform as number[])[4],
        y: (i.transform as number[])[5],
        width: i.width ?? 0,
        // `height` vem 0 em alguns PDFs; o escalonamento vertical da matriz
        // é a altura real da fonte.
        height: i.height || Math.abs((i.transform as number[])[3]) || 10,
      }));
    pages.push({ items, width: viewport.width, height: viewport.height });
    onProgress?.(n, doc.numPages);
  }
  return pages;
}

/** Atalho: documento aberto → texto em ordem de leitura. */
export async function extractText(doc: PdfDocument, onProgress?: OnProgress): Promise<string> {
  return documentToText(await extractPages(doc, onProgress));
}
