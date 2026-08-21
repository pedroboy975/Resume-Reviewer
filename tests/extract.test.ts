import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { extractPages } from '@/lib/pdf';
import { documentToText, findGutter } from '@/lib/layout';

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));
const pdfs = readdirSync(FIXTURES).filter((f) => f.toLowerCase().endsWith('.pdf'));

// Build legacy: é o que roda em Node. No browser o worker usa o build normal.
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const pagesOf = async (file: string) => {
  const data = new Uint8Array(readFileSync(`${FIXTURES}/${file}`));
  const doc = await pdfjs.getDocument({ data }).promise;
  return extractPages(doc as never);
};

describe.each(pdfs)('extração de %s', (file) => {
  it('sai texto legível', async () => {
    const text = documentToText(await pagesOf(file));
    expect(text.length).toBeGreaterThan(500);
    // Currículo sem letra minúscula é lixo de extração, não currículo.
    expect(text).toMatch(/[a-záéíóúâêôãõç]{4,}/);
    // Linha absurdamente longa é sinal de colunas costuradas na ordem errada.
    expect(Math.max(...text.split('\n').map((l) => l.length))).toBeLessThan(400);
  });

  it('todo item extraído tem posição numérica', async () => {
    for (const page of await pagesOf(file)) {
      for (const i of page.items) {
        expect(Number.isFinite(i.x) && Number.isFinite(i.y), i.str).toBe(true);
        expect(i.height).toBeGreaterThan(0);
      }
    }
  });
});

it('o conjunto de fixtures cobre layout de duas colunas', async () => {
  // Contrato de tests/fixtures/README.md. Duas colunas é onde pdfjs erra a
  // ordem de leitura — sem um fixture assim, o detector não está sendo testado.
  const flags = await Promise.all(
    pdfs.map(async (f) => (await pagesOf(f)).some((p) => findGutter(p) !== null)),
  );
  expect(flags.some(Boolean)).toBe(true);
});
