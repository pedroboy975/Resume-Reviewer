import { describe, it, expect } from 'vitest';
import { checkField, checkLength, countChars, LINKEDIN } from '@/lib/limits';

describe('countChars', () => {
  it('conta o que o usuário vê, não unidades UTF-16', () => {
    // Emoji fora do plano básico ocupa duas unidades em String.length.
    expect('🚀'.length).toBe(2);
    expect(countChars('🚀')).toBe(1);
  });

  it('normaliza acento composto', () => {
    expect(countChars('á')).toBe(1);
    expect(countChars('á')).toBe(1);
  });
});

describe('checkLength', () => {
  it('sobra e falta', () => {
    expect(checkLength('abc', 5)).toEqual({ length: 3, limit: 5, remaining: 2, fits: true });
    expect(checkLength('abcdef', 5)).toEqual({ length: 6, limit: 5, remaining: -1, fits: false });
  });

  it('exatamente no limite cabe', () => {
    expect(checkLength('abcde', 5).fits).toBe(true);
  });
});

describe('checkField', () => {
  it('usa o limite do campo do LinkedIn', () => {
    expect(checkField('headline', 'x'.repeat(220)).fits).toBe(true);
    expect(checkField('headline', 'x'.repeat(221)).fits).toBe(false);
    expect(checkField('about', 'x'.repeat(LINKEDIN.about + 1)).remaining).toBe(-1);
  });
});
