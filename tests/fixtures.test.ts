import { describe, it, expect } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));

const pdfs = readdirSync(FIXTURES).filter((f) => f.toLowerCase().endsWith('.pdf'));

describe('fixtures', () => {
  // O ROADMAP trata os 5 PDFs como não-opcionais: sem eles o parser é
  // desenvolvido contra um currículo imaginário. Este teste é o guarda disso.
  it('tem pelo menos 5 PDFs', () => {
    expect(pdfs.length).toBeGreaterThanOrEqual(5);
  });

  it('inclui ao menos um export de perfil do LinkedIn', () => {
    expect(pdfs.some((f) => /^profile/i.test(f))).toBe(true);
  });

  it('nenhum PDF está vazio', () => {
    for (const f of pdfs) {
      expect(statSync(`${FIXTURES}/${f}`).size, f).toBeGreaterThan(1024);
    }
  });
});
