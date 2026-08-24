import { describe, expect, it } from 'vitest';
import { findScopeEvidence } from '../src/lib/scope';
import { assignLines, groupAssignedLines } from '../src/lib/sections';

const panelOf = (text: string) => {
  const lines = text.split('\n');
  return findScopeEvidence(groupAssignedLines(lines, assignLines(text)));
};

const quotes = (panel: ReturnType<typeof panelOf>, axis: string) =>
  panel.proven.filter((e) => e.axis === axis).map((e) => e.quote);

describe('findScopeEvidence', () => {
  it('separa os três eixos e cita verbatim', () => {
    const p = panelOf(
      [
        'EXPERIÊNCIA PROFISSIONAL',
        'Gerente de Operações',
        'jan/2019 – dez/2023',
        '- Estruturei o processo de onboarding que a área usa até hoje.',
        '- Liderei equipe de 6 analistas distribuídos em duas unidades.',
        '- Responsável por orçamento anual da diretoria de operações.',
      ].join('\n'),
    );

    expect(quotes(p, 'decisao')).toContain(
      'Estruturei o processo de onboarding que a área usa até hoje.',
    );
    expect(quotes(p, 'lideranca')).toContain(
      'Liderei equipe de 6 analistas distribuídos em duas unidades.',
    );
    expect(quotes(p, 'responsabilidade')).toContain(
      'Responsável por orçamento anual da diretoria de operações.',
    );
    expect(p.emptyAxes).toEqual([]);
  });

  it('acento não esconde evidência', () => {
    // "líder" com acento quebrava o radical `lider` — mesmo bug do "mês" em
    // companies.ts, mesma correção.
    const p = panelOf(
      [
        'EXPERIÊNCIA',
        'Atuei como líder técnico do time responsável pela migração inteira.',
      ].join('\n'),
    );
    expect(quotes(p, 'lideranca')).toHaveLength(1);
  });

  it('sinal em Competências promete, não comprova', () => {
    const p = panelOf(
      ['COMPETÊNCIAS', 'Liderança, comunicação, gestão de conflitos'].join('\n'),
    );

    expect(p.proven).toEqual([]);
    expect(p.claimed.map((e) => e.axis)).toContain('lideranca');
    // E o eixo continua vazio do lado comprovado: é exatamente a distância
    // entre nível prometido e nível comprovado da regra 5.
    expect(p.emptyAxes).toContain('lideranca');
  });

  it('"trabalhei em equipe" não é evidência de liderança', () => {
    const p = panelOf(
      [
        'EXPERIÊNCIA',
        'Sempre trabalhei em equipe e mantive bom relacionamento interno.',
      ].join('\n'),
    );
    expect(quotes(p, 'lideranca')).toEqual([]);
  });

  it('termo de volume sem número não conta', () => {
    const semNumero = panelOf(
      ['EXPERIÊNCIA', 'Fiz atendimento a clientes e apoiei rotinas da área.'].join('\n'),
    );
    const comNumero = panelOf(
      ['EXPERIÊNCIA', 'Atendi carteira com 320 clientes ativos por mês na região.'].join('\n'),
    );

    expect(quotes(semNumero, 'responsabilidade')).toEqual([]);
    expect(quotes(comNumero, 'responsabilidade')).toHaveLength(1);
  });

  it('nada é descartado: o que não casou vai para unclassified', () => {
    const linha = 'Apoiei as rotinas administrativas do setor durante todo o período.';
    const p = panelOf(['EXPERIÊNCIA', linha].join('\n'));

    expect(p.proven).toEqual([]);
    expect(p.unclassified).toEqual([linha]);
    expect(p.emptyAxes).toHaveLength(3);
  });

  it('currículo em inglês aciona os mesmos eixos', () => {
    // Fixture sintética: nenhum dos PDFs reais é em inglês, então isto pega
    // regressão de regex, não currículo em inglês escrito de forma imprevista.
    const p = panelOf(
      [
        'EXPERIENCE',
        '- Led a team of 12 engineers across three product lines.',
        '- Accountable for the regional budget and quarterly revenue targets.',
        '- Established the incident response process from scratch.',
      ].join('\n'),
    );

    expect(quotes(p, 'lideranca')).toHaveLength(1);
    expect(quotes(p, 'responsabilidade')).toHaveLength(1);
    expect(quotes(p, 'decisao')).toHaveLength(1);
  });

  it('cargo e empresa não viram evidência', () => {
    const p = panelOf(
      ['EXPERIÊNCIA', 'Gerente de Contas — Empresa Alfa', 'jan/2020 – dez/2022'].join('\n'),
    );
    expect(p.proven).toEqual([]);
    expect(p.unclassified).toEqual([]);
  });

  it('documento vazio não quebra', () => {
    const p = findScopeEvidence([]);
    expect(p.proven).toEqual([]);
    expect(p.claimed).toEqual([]);
    expect(p.emptyAxes).toHaveLength(3);
  });
});
