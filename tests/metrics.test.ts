import { describe, expect, it } from 'vitest';
import { extractCompanies } from '../src/lib/companies';
import { parsePeriods } from '../src/lib/dates';
import { findMissingMetrics, metricKey } from '../src/lib/metrics';

describe('findMissingMetrics', () => {
  it('sinaliza bullet sem nenhum dígito', () => {
    const text = 'Responsável pela gestão de caixa e relacionamento bancário da empresa.';
    const found = findMissingMetrics(text);
    expect(found).toHaveLength(1);
    expect(found[0].quote).toBe(text);
  });

  it('junta linhas quebradas pelo pdfjs no meio da frase', () => {
    const text = [
      'Responsável pela gestão de caixa, fluxo de caixa, relacionamento bancário e',
      'operações financeiras para apoiar a tomada de decisão.',
    ].join('\n');
    const found = findMissingMetrics(text);
    expect(found).toHaveLength(1);
    expect(found[0].quote).toContain('relacionamento bancário e operações financeiras');
  });

  it('não sinaliza bullet que já tem número', () => {
    const text = 'Reduzi o tempo de fechamento contábil da área toda em 3 dias por mês.';
    expect(findMissingMetrics(text)).toHaveLength(0);
  });

  it('não sinaliza linha de data', () => {
    const text = 'outubro de 2023 - maio de 2026';
    expect(findMissingMetrics(text)).toHaveLength(0);
  });

  it('ignora cargo, empresa (cabeçalho antes da data) e cidade', () => {
    const text = [
      'Kinross Gold Corporation',
      'Especialista de Tesouraria',
      'maio de 2026 - Present',
      'Belo Horizonte, MG',
    ].join('\n');
    expect(findMissingMetrics(text)).toHaveLength(0);
  });

  it('trata marcador de lista como início de um novo bullet', () => {
    const text = [
      '- Gerenciar atividades e equipes multidisciplinares das áreas de compras internas',
      '- Realizar a gestão de indicadores de cada setor garantindo o atendimento aos padrões',
    ].join('\n');
    const found = findMissingMetrics(text);
    expect(found).toHaveLength(2);
  });
});

describe('findMissingMetrics — vínculo do trecho', () => {
  // O caso que motivou o rótulo: mesma atividade, empresas diferentes.
  const text = [
    'Empresa Alfa',
    'Analista de Compras',
    'jan/2018 - dez/2019',
    'Negociei com fornecedores e acompanhei a rotina de pedidos do setor.',
    '',
    'Empresa Beta',
    'Coordenador de Compras',
    'jan/2020 - atual',
    'Negociei com fornecedores e acompanhei a rotina de pedidos do setor.',
  ].join('\n');

  const found = () => {
    const periods = parsePeriods(text);
    return findMissingMetrics(text, extractCompanies(text, periods));
  };

  it('marca cada trecho com o vínculo em que aparece', () => {
    const out = found();
    expect(out).toHaveLength(2);
    expect(out[0].label).toContain('Alfa');
    expect(out[1].label).toContain('Beta');
  });

  it('dá chaves distintas a citações idênticas em vínculos diferentes', () => {
    const [a, b] = found();
    expect(a.quote).toBe(b.quote);
    expect(metricKey(a)).not.toBe(metricKey(b));
  });

  it('deixa o rótulo nulo em vez de herdar o vínculo errado', () => {
    const orphan = 'Negociei com fornecedores e acompanhei a rotina de pedidos do setor.';
    expect(findMissingMetrics(orphan, [])[0].label).toBeNull();
  });
});

/**
 * Três formas reais de currículo em que o cabeçalho do vínculo e a descrição
 * se misturam. As três vieram de fixtures, e as duas primeiras custaram o
 * documento inteiro ou o começo de cada citação.
 */
describe('onde termina o cabeçalho do vínculo', () => {
  it('descrição acima da data não é cabeçalho, por mais que a data venha depois', () => {
    // Currículo de duas colunas: cargo à esquerda, descrição à direita, data
    // abaixo das duas. A regra antiga descartava a experiência inteira.
    const text = [
      'Realizo prospecção, abordagem e mapeamento de turmas de formatura em',
      'Minas Gerais. Levantamento de briefing e apresentação de proposta comercial.',
      '01/2018 - em andamento',
    ].join('\n');

    expect(findMissingMetrics(text).length).toBeGreaterThan(0);
  });

  it('rótulo em caixa alta abaixo da data não entra na citação', () => {
    const text = [
      '01/04/2019 – ATUAL',
      'LÍDER DE AREA, OFFERWISE PESQUISA DE MERCADO',
      'Ser referência para as equipes, auxiliando nas dúvidas e soluções do time.',
    ].join('\n');

    expect(findMissingMetrics(text).map((m) => m.quote)).toEqual([
      'Ser referência para as equipes, auxiliando nas dúvidas e soluções do time.',
    ]);
  });

  it('linha de descrição quebrada abaixo da data continua sendo descrição', () => {
    // Guarda contra a primeira versão da regra acima, que aceitava qualquer
    // linha curta sem pontuação final — e comia a descrição da pessoa.
    const text = [
      'novembro de 2023 - junho de 2026',
      'Atuação focada na gestão consultiva de carteira e prospecção estratégica,',
      'com o objetivo central de migração para o segmento de Alta Renda.',
    ].join('\n');

    expect(findMissingMetrics(text)[0].quote).toContain('Atuação focada na gestão consultiva');
  });
});
