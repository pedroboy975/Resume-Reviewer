import { describe, expect, it } from 'vitest';
import { acronymsIn, findRequirements, inDocument } from '../src/lib/requirements';

const kinds = (job: string) => findRequirements(job).map((r) => r.kind);
const first = (job: string) => findRequirements(job)[0];

describe('findRequirements', () => {
  it('lê o piso de anos e a modalidade que o texto declarou', () => {
    const r = first('Mínimo de 12 anos de experiência em posição similar.');
    expect(r).toMatchObject({ kind: 'anos', years: 12, modality: 'obrigatório' });
    expect(r.quote).toBe('Mínimo de 12 anos de experiência em posição similar.');
  });

  it.each([
    'Empresa com 30 anos de mercado e presença nacional.',
    'Programa de trainee com 2 anos de duração e bolsa mensal.',
  ])('não confunde %s com requisito de senioridade', (linha) => {
    expect(kinds(linha)).not.toContain('anos');
  });

  it('preserva "diferencial" em vez de promover a obrigatório', () => {
    // A falha que motivou o módulo: "(diferencial)" no texto virou
    // "certificações obrigatórias" na saída.
    const r = first('Certificação CFP, CEA ou CGA (diferencial).');
    expect(r).toMatchObject({ kind: 'certificacao', modality: 'diferencial' });
  });

  it('na dúvida entre duas modalidades, fica com a mais fraca', () => {
    expect(first('Certificação CPA-20 obrigatória, CEA desejável.').modality).toBe('desejável');
  });

  it('sem palavra de modalidade, não inventa uma', () => {
    expect(first('Graduação completa em Economia ou Administração.').modality).toBe(
      'não declarada',
    );
  });

  it('acha formação e idioma na mesma vaga', () => {
    const job = [
      'Graduação completa em Engenharia ou áreas correlatas.',
      'Inglês fluente é obrigatório para a rotina com a matriz.',
    ].join('\n');
    expect(kinds(job)).toEqual(['formacao', 'idioma']);
  });

  it('vaga sem requisito duro não produz nada', () => {
    expect(findRequirements('Venha fazer parte de um time apaixonado por gente.')).toEqual([]);
  });
});

describe('siglas de certificação', () => {
  it('lista as siglas nomeadas na frase, sem repetir', () => {
    expect(acronymsIn('Certificação CFP, CEA ou CGA. CFP é o mais comum.')).toEqual([
      'CFP',
      'CEA',
      'CGA',
    ]);
  });

  it('reconhece a sigla com número colado', () => {
    expect(acronymsIn('Certificação CPA-20 obrigatória.')).toContain('CPA-20');
  });

  it('diz se a sigla aparece no documento da pessoa', () => {
    const cv = 'Certificado CPA-20 pela ANBIMA em 2021.';
    expect(inDocument(cv, 'CPA-20')).toBe(true);
    expect(inDocument(cv, 'CEA')).toBe(false);
  });
});
