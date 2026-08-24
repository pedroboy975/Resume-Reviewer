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
