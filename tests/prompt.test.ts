import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CAREER_PROMPT, extractFenced } from '@/lib/prompt';

const SOURCE = fileURLToPath(new URL('../docs/prompt_agente_analise_carreira.md', import.meta.url));

describe('extractFenced', () => {
  it('devolve o conteúdo entre as cercas', () => {
    expect(extractFenced('# Título\n\n```\nconteúdo\n```\n')).toBe('conteúdo');
  });

  it('sem cerca, devolve o markdown inteiro', () => {
    expect(extractFenced('sem cerca aqui')).toBe('sem cerca aqui');
  });
});

describe('CAREER_PROMPT', () => {
  it('é o prompt do documento de origem, não uma cópia editada', () => {
    // O CLAUDE.md proíbe reescrever ou resumir o prompt em outro arquivo.
    // Este teste é o guarda: se alguém copiar o texto para dentro do código,
    // a comparação com o arquivo de origem quebra.
    expect(CAREER_PROMPT).toBe(extractFenced(readFileSync(SOURCE, 'utf8')));
  });

  it('traz as regras absolutas e as seis fases', () => {
    expect(CAREER_PROMPT).toContain('REGRAS ABSOLUTAS');
    for (const fase of [1, 2, 3, 4, 5, 6]) {
      expect(CAREER_PROMPT).toContain(`FASE ${fase} —`);
    }
  });

  it('não arrasta a cerca de código junto', () => {
    expect(CAREER_PROMPT.startsWith('```')).toBe(false);
    expect(CAREER_PROMPT.endsWith('```')).toBe(false);
  });
});

describe('extractFenced · segunda cerca', () => {
  it('pega o primeiro bloco, não do primeiro ao último marcador', () => {
    // Um segundo bloco de código adicionado ao documento entraria no prompt
    // sem ninguém perceber se o fechamento fosse a última cerca do arquivo.
    const markdown = ['# Título', '', '```', 'o prompt', '```', '', 'Nota.', '', '```', 'exemplo', '```'].join('\n');
    expect(extractFenced(markdown)).toBe('o prompt');
  });

  it('cerca sem fechamento vai até o fim do arquivo', () => {
    expect(extractFenced('# Título\n\n```\no prompt')).toBe('o prompt');
  });
});
