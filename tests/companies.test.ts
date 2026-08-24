import { describe, expect, it } from 'vitest';
import { chronological, extractCompanies } from '../src/lib/companies';
import { parsePeriods } from '../src/lib/dates';

describe('extractCompanies', () => {
  it('junta cargo e empresa quando são duas linhas seguidas acima da data', () => {
    const text = ['Empresa Prime', 'Analista de Dados', 'jan/2020 – atual'].join('\n');
    const periods = parsePeriods(text);
    const stints = extractCompanies(text, periods);
    expect(stints).toHaveLength(1);
    expect(stints[0].label).toBe('Empresa Prime — Analista de Dados');
  });

  it('mantém a ordem do documento mesmo com cargo antes da empresa', () => {
    const text = ['Analista de Dados', 'Empresa Prime', 'jan/2020 – atual'].join('\n');
    const periods = parsePeriods(text);
    const stints = extractCompanies(text, periods);
    expect(stints[0].label).toBe('Analista de Dados — Empresa Prime');
  });

  it('acha rótulo na mesma linha da data', () => {
    const text = 'Empresa Alfa — mar/2018 a dez/2019';
    const periods = parsePeriods(text);
    const stints = extractCompanies(text, periods);
    expect(stints).toHaveLength(1);
    expect(stints[0].label).toBe('Empresa Alfa');
  });

  it('combina uma linha acima com a mesma linha da data', () => {
    const text = ['Analista de Dados', 'Empresa Alfa — mar/2018 a dez/2019'].join('\n');
    const periods = parsePeriods(text);
    const stints = extractCompanies(text, periods);
    expect(stints[0].label).toBe('Analista de Dados — Empresa Alfa');
  });

  it('não inventa rótulo quando a linha de cima também é data', () => {
    const text = ['fev/2015 - jan/2018', 'jan/2018 - dez/2019'].join('\n');
    const periods = parsePeriods(text);
    const stints = extractCompanies(text, periods);
    expect(stints).toHaveLength(0);
  });

  it('ordena do mais antigo para o mais recente', () => {
    const text = [
      'Empresa Recente',
      'jan/2022 – atual',
      '',
      'Empresa Antiga',
      'jan/2018 – dez/2020',
    ].join('\n');
    const periods = parsePeriods(text);
    const stints = chronological(extractCompanies(text, periods));
    expect(stints.map((s) => s.label)).toEqual(['Empresa Antiga', 'Empresa Recente']);
  });
});

describe('bullet do vínculo anterior não vira rótulo', () => {
  // Sem linha em branco entre um vínculo e o próximo, o último bullet do
  // anterior encosta na data do seguinte.
  const text = [
    'Trading Ltda. — Assistente',
    'jan/2015 - dez/2016',
    'Pagamento de taxas referentes a liberação da carga;',
    'Geoline Engenharia — Assistente de Projetos',
    'jan/2017 - dez/2018',
  ].join('\n');

  it('usa o cargo/empresa real, não a frase de resultado', () => {
    const [, segundo] = extractCompanies(text, parsePeriods(text));
    expect(segundo.label).toContain('Geoline');
    expect(segundo.label).not.toContain('Pagamento de taxas');
  });

  it('não descarta nome de empresa com abreviação no fim', () => {
    const [primeiro] = extractCompanies(text, parsePeriods(text));
    expect(primeiro.label).toContain('Trading Ltda.');
  });
});
