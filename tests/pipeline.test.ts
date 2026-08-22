/**
 * O caminho inteiro, do PDF ao dossiê, no mesmo encadeamento que a página usa.
 *
 * É o critério do Sprint 4: uma análise de ponta a ponta que sai melhor do que
 * colar o PDF cru num chat.
 */

import { describe, it, expect } from 'vitest';
import { analyze } from '@/lib/analysis';
import { buildDossier, EMPTY_CONTEXT } from '@/lib/dossier';
import { findPii, redact } from '@/lib/pii';
import { assignLines } from '@/lib/sections';
import { fixtureNames, fixtureText } from './helpers/fixtures';

const NOW = new Date('2026-08-21');

/** O mesmo caminho que a página percorre: redigir, analisar, montar. */
async function run(file: string) {
  const raw = await fixtureText(file);
  const { text, findings } = redact(raw);
  const analysis = analyze(text, assignLines(text), { now: NOW });
  return {
    raw,
    findings,
    dossier: buildDossier({
      analysis,
      context: {
        ...EMPTY_CONTEXT,
        targetRole: 'Gerente de Operações',
        targetLevel: 'Sênior',
        country: 'Brasil',
      },
      pii: findings,
      metrics: analysis.missingMetrics.map((finding) => ({ finding, answer: '' })),
      jobs: ['Vaga colada de exemplo: liderar equipe de operações.'],
      now: NOW,
    }),
  };
}

describe.each(fixtureNames)('%s', (file) => {
  it('gera um dossiê com prompt, documento, achados e vagas', async () => {
    const { dossier } = await run(file);
    expect(dossier).toContain('REGRAS ABSOLUTAS');
    expect(dossier).toContain('## Documento');
    expect(dossier).toContain('### Experiência');
    expect(dossier).toContain('## Achados determinísticos');
    expect(dossier).toContain('### Vaga 1');
  });

  it('nenhum dado pessoal do currículo aparece no dossiê', async () => {
    // A verificação que mais importa: é o texto que sai do app e vai para um
    // chat de terceiro. Ver CLAUDE.md > PII.
    const { raw, dossier } = await run(file);
    for (const finding of findPii(raw)) {
      expect(dossier, `${finding.kind}: ${finding.quote}`).not.toContain(finding.quote);
    }
  });

  it('o dossiê é maior que o documento, e não por pouco', async () => {
    // Se fosse do tamanho do currículo, não estaria agregando nada ao que a
    // pessoa já poderia colar sozinha.
    const { raw, dossier } = await run(file);
    expect(dossier.length).toBeGreaterThan(raw.length + 5000);
  });
});
