import { describe, expect, it } from 'vitest';
import { findBuzzwords } from '../src/lib/buzzwords';

describe('findBuzzwords', () => {
  it('acha termo isolado', () => {
    const found = findBuzzwords('Profissional proativo com foco em entregas.');
    expect(found).toHaveLength(1);
    expect(found[0].quote).toBe('proativo');
  });

  it('acha frase de mais de uma palavra', () => {
    const found = findBuzzwords('Time orientado a resultados desde o início.');
    expect(found.map((f) => f.quote)).toEqual(['orientado a resultados']);
  });

  it('é case-insensitive e preserva o texto original na citação', () => {
    const found = findBuzzwords('PROATIVO e Dinâmico.');
    expect(found.map((f) => f.quote)).toEqual(['PROATIVO', 'Dinâmico']);
  });

  it('não confunde palavra que só contém o termo como substring', () => {
    // "proatividade" não deve casar com "proativo" nem "proativa" isolados.
    const found = findBuzzwords('Buscamos alta proatividade no time.');
    expect(found.map((f) => f.quote)).toEqual(['proatividade']);
  });

  it('não acha nada em texto neutro', () => {
    expect(findBuzzwords('Reduzi o tempo de fechamento contábil em 3 dias.')).toHaveLength(0);
  });

  it('acha múltiplas ocorrências na ordem em que aparecem', () => {
    const text = 'Resiliente, proativo e com visão estratégica.';
    const found = findBuzzwords(text);
    expect(found.map((f) => f.quote)).toEqual(['Resiliente', 'proativo', 'visão estratégica']);
    expect(found[0].index).toBe(0);
  });
});

describe('grafia sem acento', () => {
  it('acha o termo escrito sem acento e cita como está no documento', () => {
    // Currículo em caixa alta perde o acento na exportação, e um dos
    // currículos reais escreve "melhoria continua" sem o til.
    const found = findBuzzwords('Cultura de melhoria continua e VISAO ESTRATEGICA.');
    expect(found.map((f) => f.quote)).toEqual(['melhoria continua', 'VISAO ESTRATEGICA']);
  });

  it('o índice aponta para o mesmo caractere no texto acentuado', () => {
    const text = 'Atenção: perfil analítico e senso de urgência.';
    for (const f of findBuzzwords(text)) {
      expect(text.slice(f.index, f.index + f.quote.length)).toBe(f.quote);
    }
    expect(findBuzzwords(text)).toHaveLength(2);
  });
});
