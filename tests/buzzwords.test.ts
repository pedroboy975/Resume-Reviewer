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
