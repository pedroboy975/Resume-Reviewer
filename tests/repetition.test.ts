import { describe, expect, it } from 'vitest';
import { findRepeatedLines } from '../src/lib/repetition';
import { assignLines, groupAssignedLines } from '../src/lib/sections';

const repeatedIn = (text: string) =>
  findRepeatedLines(groupAssignedLines(text.split('\n'), assignLines(text)));

/** O caso real: a mesma conquista no Resumo e na Experiência, com bordas diferentes. */
const ANCORA =
  'Portabilidade de Investimentos: Viabilizei a captação de R$ 2,3 milhões em novos ativos através de parceria estratégica com assessoria de investimentos';

describe('findRepeatedLines', () => {
  it('acha a âncora repetida mesmo com as bordas diferentes', () => {
    const found = repeatedIn(
      [
        'RESUMO',
        `Destaques de Performance: ${ANCORA}.`,
        '',
        'EXPERIÊNCIA',
        'Banco Exemplo',
        'jan/2020 - atual',
        `Destaques de Performance & Foco Estratégico: ${ANCORA}, focando em clientes de Alta Renda.`,
      ].join('\n'),
    );

    expect(found).toHaveLength(1);
    expect(found[0].quote).toContain('R$ 2,3 milhões');
    expect(found[0].sections).toEqual(['resumo', 'experiencia']);
  });

  it('não reporta o mesmo par duas vezes, uma por seção', () => {
    const found = repeatedIn(
      ['RESUMO', ANCORA, '', 'EXPERIÊNCIA', 'jan/2020 - atual', ANCORA].join('\n'),
    );
    expect(found).toHaveLength(1);
  });

  it('coincidência curta de vocabulário não conta', () => {
    const found = repeatedIn(
      [
        'RESUMO',
        'Atuação em gestão de relacionamento com clientes.',
        '',
        'EXPERIÊNCIA',
        'jan/2020 - atual',
        'Responsável pela gestão de relacionamento com clientes da regional.',
      ].join('\n'),
    );
    expect(found).toEqual([]);
  });

  it('repetição dentro da mesma seção não é o achado', () => {
    // O export do LinkedIn parte "Experiência" a cada quebra de página, e os
    // pedaços voltam como blocos distintos da mesma seção.
    const found = repeatedIn(
      ['EXPERIÊNCIA', ANCORA, '', 'EXPERIÊNCIA PROFISSIONAL', ANCORA].join('\n'),
    );
    expect(found).toEqual([]);
  });

  it('documento sem repetição não produz achado', () => {
    expect(repeatedIn(['RESUMO', 'Analista de tesouraria com foco em caixa.'].join('\n'))).toEqual(
      [],
    );
  });
});
