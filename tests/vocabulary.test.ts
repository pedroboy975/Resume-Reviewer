import { describe, expect, it } from 'vitest';
import { jobVocabulary } from '../src/lib/vocabulary';

const V1 = 'Carteira de clientes alta renda com foco em renda fixa e previdência.';
const V2 = 'Atuação com carteira de clientes de alta renda e oferta de renda fixa.';
const FORA = 'Soldagem de tubulação industrial com curso NR-13 em plataforma.';

const only = (jobs: string[], doc = '') => jobVocabulary(jobs, doc).map((t) => t.term);

describe('jobVocabulary', () => {
  it('conta em quantas vagas o termo aparece, não só quantas vezes', () => {
    const found = jobVocabulary([V1, V2], '');
    expect(found.find((t) => t.term.toLowerCase() === 'renda')).toMatchObject({ jobs: 2, count: 4 });
  });

  it('junta palavras vizinhas em termo composto', () => {
    expect(only([V1, V2])).toContain('renda fixa');
  });

  it('não atravessa pontuação para formar termo composto', () => {
    // "renda fixa, renda variável" tem dois termos, não um "fixa renda".
    const found = only(['Oferta de renda fixa, renda variável.', 'Renda fixa e renda variável.']);
    expect(found).not.toContain('fixa renda');
    expect(found).toContain('renda fixa');
  });

  it('com duas vagas ou mais, o termo de uma vaga só fica de fora', () => {
    // Vocabulário de uma empresa não é vocabulário do mercado.
    expect(only([V1, FORA])).not.toContain('tubulação');
  });

  it('com uma vaga só, mostra o que ela traz', () => {
    expect(only([FORA])).toContain('tubulação');
  });

  it('marca o termo que já está no documento da pessoa', () => {
    const found = jobVocabulary([V1, V2], 'Atendi a carteira de clientes de alta renda.');
    const previdencia = found.find((t) => t.term.toLowerCase() === 'previdência');
    expect(found.find((t) => t.term.toLowerCase() === 'carteira')?.present).toBe(true);
    // Termo de uma vaga só nem entra na lista quando há duas.
    expect(previdencia).toBeUndefined();
  });

  it('palavra de ligação não vira termo', () => {
    expect(only([V1, V2])).not.toContain('com');
  });

  it('sem vaga colada não produz tabela', () => {
    expect(jobVocabulary(['', '  '], 'qualquer coisa')).toEqual([]);
  });
});
