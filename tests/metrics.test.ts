import { describe, expect, it } from 'vitest';
import { findMissingMetrics } from '../src/lib/metrics';
import { parsePeriods } from '../src/lib/dates';

const hasPeriod = (line: string) => parsePeriods(line).length > 0;

describe('findMissingMetrics', () => {
  it('sinaliza bullet sem nenhum dígito', () => {
    const text = 'Responsável pela gestão de caixa e relacionamento bancário da empresa.';
    const found = findMissingMetrics(text, hasPeriod);
    expect(found).toHaveLength(1);
    expect(found[0].quote).toBe(text);
  });

  it('junta linhas quebradas pelo pdfjs no meio da frase', () => {
    const text = [
      'Responsável pela gestão de caixa, fluxo de caixa, relacionamento bancário e',
      'operações financeiras para apoiar a tomada de decisão.',
    ].join('\n');
    const found = findMissingMetrics(text, hasPeriod);
    expect(found).toHaveLength(1);
    expect(found[0].quote).toContain('relacionamento bancário e operações financeiras');
  });

  it('não sinaliza bullet que já tem número', () => {
    const text = 'Reduzi o tempo de fechamento contábil da área toda em 3 dias por mês.';
    expect(findMissingMetrics(text, hasPeriod)).toHaveLength(0);
  });

  it('não sinaliza linha de data', () => {
    const text = 'outubro de 2023 - maio de 2026';
    expect(findMissingMetrics(text, hasPeriod)).toHaveLength(0);
  });

  it('ignora cargo, empresa (cabeçalho antes da data) e cidade', () => {
    const text = [
      'Kinross Gold Corporation',
      'Especialista de Tesouraria',
      'maio de 2026 - Present',
      'Belo Horizonte, MG',
    ].join('\n');
    expect(findMissingMetrics(text, hasPeriod)).toHaveLength(0);
  });

  it('trata marcador de lista como início de um novo bullet', () => {
    const text = [
      '- Gerenciar atividades e equipes multidisciplinares das áreas de compras internas',
      '- Realizar a gestão de indicadores de cada setor garantindo o atendimento aos padrões',
    ].join('\n');
    const found = findMissingMetrics(text, hasPeriod);
    expect(found).toHaveLength(2);
  });
});
