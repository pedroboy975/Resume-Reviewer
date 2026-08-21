/**
 * Jargão de currículo — termo genérico que substitui evidência.
 *
 * Match literal contra uma lista curada, igual `pii.ts` faz para dado
 * pessoal. O app não reescreve a frase: reescrever exigiria o modelo inferir
 * o que a pessoa quis dizer, e isso é fabricação. O que cabe aqui é
 * sinalizar o trecho verbatim (regra de citação obrigatória) e apontar o
 * formato esperado — Ação + Método + Problema + Resultado — pra quem for
 * reescrever, seja a pessoa, seja o modelo no chat externo.
 */

export type BuzzwordFinding = {
  term: string;
  quote: string;
  index: number;
};

// Curada a partir de clichês comuns em currículo em português. Ajustável:
// é só uma lista, não uma decisão estrutural.
export const BUZZWORDS = [
  'orientado a resultados',
  'orientada a resultados',
  'proativo',
  'proativa',
  'proatividade',
  'espírito de dono',
  'dono do negócio',
  'alavancar',
  'dinâmico',
  'dinâmica',
  'hands-on',
  'hands on',
  'mão na massa',
  'fora da caixa',
  'pensar fora da caixa',
  'sinergia',
  'multitarefas',
  'polivalente',
  'excelente comunicação',
  'ótima comunicação',
  'boa comunicação interpessoal',
  'facilidade de comunicação',
  'visão estratégica',
  'visão sistêmica',
  'alta performance',
  'apaixonado por',
  'apaixonada por',
  'resiliente',
  'flexível e adaptável',
  'comprometido com resultados',
  'comprometida com resultados',
  'gerar valor',
  'entregar valor',
  'impactar positivamente',
  'protagonismo',
  'ninja',
  'fera em',
  'antenado',
  'antenada',
] as const;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERN = new RegExp(`\\b(${BUZZWORDS.map(escapeRegex).join('|')})\\b`, 'gi');

/** Ocorrências, na ordem em que aparecem em `text`. */
export function findBuzzwords(text: string): BuzzwordFinding[] {
  return [...text.matchAll(PATTERN)].map((m) => ({
    term: m[0].toLowerCase(),
    quote: m[0],
    index: m.index,
  }));
}
