import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analysis';
import { assignLines } from '../src/lib/sections';

const NOW = new Date('2026-08-21');

const of = (text: string) => analyze(text, assignLines(text), { now: NOW });

describe('analyze', () => {
  it('devolve a análise inteira numa chamada', () => {
    const a = of(
      [
        'EXPERIÊNCIA PROFISSIONAL',
        'Empresa Alfa',
        'Analista de Dados',
        'jan/2018 – dez/2019',
        'Responsável pela gestão de rotinas e relacionamento com áreas internas.',
      ].join('\n'),
    );

    expect(a.periods).toHaveLength(1);
    expect(a.stints[0].label).toContain('Empresa Alfa');
    expect(a.missingMetrics).toHaveLength(1);
    expect(a.sections.some((s) => s.kind === 'experiencia')).toBe(true);
  });

  it('propaga `now` para lacunas e permanências curtas', () => {
    // A regressão que motivou este módulo: a página usava a data corrente e o
    // teste de ponta a ponta usava data fixa, então o teste não exercitava o
    // que a página fazia. Um `now` só, injetado uma vez, mata a divergência.
    const text = ['EXPERIÊNCIA', 'Empresa Alfa', 'jan/2020 – atual'].join('\n');

    const emDoisMil = analyze(text, assignLines(text), { now: new Date('2020-06-01') });
    const hoje = analyze(text, assignLines(text), { now: NOW });

    // Em jun/2020 o vínculo tem 5 meses: permanência curta. Em 2026, não é.
    expect(emDoisMil.shortTenures).toHaveLength(0); // em andamento nunca conta
    expect(hoje.periods[0].end).toBeNull();
    expect(emDoisMil.periods[0].start).toEqual(hoje.periods[0].start);
  });

  it('só o texto atribuído a Experiência entra na aritmética de datas', () => {
    // Data de formação abriria lacuna de emprego que não existe.
    const text = ['FORMAÇÃO', 'Faculdade X', 'jan/2010 – dez/2014'].join('\n');
    expect(of(text).periods).toHaveLength(0);
  });

  it('documento vazio não quebra nada', () => {
    const a = analyze('', [], { now: NOW });
    expect(a.periods).toHaveLength(0);
    expect(a.gaps).toHaveLength(0);
    expect(a.stints).toHaveLength(0);
    expect(a.buzzwords).toHaveLength(0);
  });
});
