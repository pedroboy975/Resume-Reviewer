import { describe, it, expect } from 'vitest';
import { documentToText, findGutter } from '@/lib/layout';
import { fixtureNames, fixturePages, fixtureText } from './helpers/fixtures';

describe.each(fixtureNames)('extração de %s', (file) => {
  it('sai texto legível', async () => {
    const text = await fixtureText(file);
    expect(text.length).toBeGreaterThan(500);
    // Currículo sem letra minúscula é lixo de extração, não currículo.
    expect(text).toMatch(/[a-záéíóúâêôãõç]{4,}/);
    // Linha absurdamente longa é sinal de colunas costuradas na ordem errada.
    expect(Math.max(...text.split('\n').map((l) => l.length))).toBeLessThan(400);
  });

  it('todo item extraído tem posição numérica', async () => {
    for (const page of await fixturePages(file)) {
      for (const i of page.items) {
        expect(Number.isFinite(i.x) && Number.isFinite(i.y), i.str).toBe(true);
        expect(i.height).toBeGreaterThan(0);
      }
    }
  });

  it('o texto do documento é a soma das páginas', async () => {
    expect(documentToText(await fixturePages(file))).toBe(await fixtureText(file));
  });
});

it('o conjunto de fixtures cobre layout de duas colunas', async () => {
  // Contrato de tests/fixtures/README.md. Duas colunas é onde pdfjs erra a
  // ordem de leitura — sem um fixture assim, o detector não está sendo testado.
  const flags = await Promise.all(
    fixtureNames.map(async (f) => (await fixturePages(f)).some((p) => findGutter(p) !== null)),
  );
  expect(flags.some(Boolean)).toBe(true);
});
