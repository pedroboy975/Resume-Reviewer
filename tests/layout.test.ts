import { describe, it, expect } from 'vitest';
import { findGutter, pageToText, toLines, type Item, type Page } from '@/lib/layout';

const item = (str: string, x: number, y: number, width = str.length * 5, height = 10): Item => ({
  str,
  x,
  y,
  width,
  height,
});

const page = (items: Item[]): Page => ({ items, width: 600, height: 800 });

describe('toLines', () => {
  it('agrupa por linha de base e ordena da esquerda para a direita', () => {
    expect(
      toLines([item('mundo', 100, 700), item('Olá', 50, 700), item('abaixo', 50, 680)]),
    ).toEqual(['Olá mundo', 'abaixo']);
  });

  it('separa itens colados quando há espaço geométrico entre eles', () => {
    // Fonte grande: a distância entre os itens é pequena em relação ao corpo.
    expect(toLines([item('BÁRBARA', 121, 762, 165, 35), item('MACHADO', 295, 762, 150, 35)])).toEqual([
      'BÁRBARA MACHADO',
    ]);
  });

  it('não inventa espaço no meio de uma palavra quebrada em dois itens', () => {
    expect(toLines([item('care', 50, 700, 20), item('er', 70, 700, 10)])).toEqual(['career']);
  });
});

describe('findGutter', () => {
  it('devolve null em página de coluna única', () => {
    const items = [0, 1, 2, 3].map((n) => item('linha de texto corrida', 50, 700 - n * 12, 500));
    expect(findGutter(page(items))).toBeNull();
  });

  it('encontra a calha em página de duas colunas', () => {
    const items = [
      ...[0, 1, 2, 3].map((n) => item('barra lateral', 40, 700 - n * 12, 120)),
      ...[0, 1, 2, 3].map((n) => item('conteúdo principal', 250, 700 - n * 12, 300)),
    ];
    const gutter = findGutter(page(items));
    expect(gutter).not.toBeNull();
    expect(gutter!).toBeGreaterThan(160);
    expect(gutter!).toBeLessThan(250);
  });

  it('ignora divisão em que um dos lados quase não tem conteúdo', () => {
    const items = [
      item('nota', 40, 700, 30),
      ...[0, 1, 2, 3, 4, 5].map((n) => item('conteúdo principal', 250, 700 - n * 12, 300)),
    ];
    expect(findGutter(page(items))).toBeNull();
  });
});

describe('pageToText', () => {
  it('lê a coluna esquerda inteira antes da direita', () => {
    const items = [
      ...['contato', 'e-mail', 'idiomas'].map((s, n) => item(s, 40, 700 - n * 12, 120)),
      ...['resumo', 'experiência', 'formação'].map((s, n) => item(s, 250, 700 - n * 12, 300)),
    ];
    expect(pageToText(page(items)).split('\n')).toEqual([
      'contato',
      'e-mail',
      'idiomas',
      'resumo',
      'experiência',
      'formação',
    ]);
  });

  it('cabeçalho que atravessa a calha corta a página em blocos', () => {
    const items = [
      item('NOME COMPLETO NO TOPO DA PÁGINA', 40, 760, 520, 20),
      ...['contato', 'idiomas'].map((s, n) => item(s, 40, 700 - n * 12, 120)),
      ...['resumo', 'experiência'].map((s, n) => item(s, 250, 700 - n * 12, 300)),
    ];
    expect(pageToText(page(items)).split('\n')).toEqual([
      'NOME COMPLETO NO TOPO DA PÁGINA',
      'contato',
      'idiomas',
      'resumo',
      'experiência',
    ]);
  });

  it('não perde item que está na mesma linha de base do cabeçalho', () => {
    const items = [
      item('CABEÇALHO LARGO ATRAVESSANDO TUDO', 40, 760, 520, 20),
      item('data', 500, 760, 40, 20),
      ...['contato', 'idiomas'].map((s, n) => item(s, 40, 700 - n * 12, 120)),
      ...['resumo', 'experiência'].map((s, n) => item(s, 250, 700 - n * 12, 300)),
    ];
    expect(pageToText(page(items))).toContain('data');
  });
});
