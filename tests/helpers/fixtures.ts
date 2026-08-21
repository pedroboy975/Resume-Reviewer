/**
 * Currículos reais de `tests/fixtures/`, extraídos uma vez por execução.
 *
 * Os PDFs não são versionados (PII não anonimizada). Quem clona o repo põe os
 * próprios. Ver `tests/fixtures/README.md`.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractPages } from '@/lib/pdf';
import { documentToText, type Page } from '@/lib/layout';

const DIR = fileURLToPath(new URL('../fixtures', import.meta.url));

export const fixtureNames = readdirSync(DIR).filter((f) => f.toLowerCase().endsWith('.pdf'));

const cache = new Map<string, Promise<Page[]>>();

/** Build legacy do pdfjs: é o que roda em Node. No browser o app usa o normal. */
async function open(file: string): Promise<Page[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(`${DIR}/${file}`));
  const doc = await pdfjs.getDocument({ data }).promise;
  return extractPages(doc as never);
}

export function fixturePages(file: string): Promise<Page[]> {
  const cached = cache.get(file);
  if (cached) return cached;
  const pages = open(file);
  cache.set(file, pages);
  return pages;
}

export const fixtureText = async (file: string): Promise<string> =>
  documentToText(await fixturePages(file));
