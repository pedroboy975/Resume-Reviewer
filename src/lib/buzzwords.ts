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

import { stripAccents } from './companies';

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
  // Rodados contra os currículos reais: a lista acima acertava um termo em
  // dois dos seis documentos, e os quatro silenciosos estavam cheios de
  // jargão. O que faltava não era um clichê exótico, era o vocabulário comum.
  'melhoria contínua',
  'foco no cliente',
  'foco em resultados',
  'alto desempenho',
  'alta complexidade',
  'trabalho em equipe',
  'relacionamento interpessoal',
  'liderança exemplar',
  'liderança inspiradora',
  'senso de dono',
  'senso de urgência',
  'agregar valor',
  'vasta experiência',
  'ampla experiência',
  'sólido conhecimento',
  'sólidos conhecimentos',
  'visão de negócio',
  'visão 360',
  'perfil analítico',
  'movido por desafios',
  'gosto por desafios',
  'excelência operacional',
  'busca pela excelência',
] as const;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERN = new RegExp(
  `\\b(${BUZZWORDS.map((b) => escapeRegex(stripAccents(b))).join('|')})\\b`,
  'gi',
);

/**
 * Ocorrências, na ordem em que aparecem em `text`.
 *
 * O casamento roda sobre o texto sem acento, e a lista é escrita com acento:
 * currículo em caixa alta perde acento na exportação ("VISAO ESTRATEGICA"), e
 * dois dos seis currículos reais escrevem "melhoria continua" sem o til. Manter
 * as duas grafias na lista seria manter a mesma decisão em dois lugares — o
 * mesmo motivo do `stripAccents` em companies.ts.
 *
 * `quote` sai do texto original, não do achatado: a citação é verbatim.
 * Ver CLAUDE.md > Citação obrigatória.
 */
export function findBuzzwords(text: string): BuzzwordFinding[] {
  const flat = stripAccents(text);
  // Decomposição sem forma precomposta muda o comprimento, e aí o índice do
  // achatado não aponta mais para o mesmo caractere do original.
  const haystack = flat.length === text.length ? flat : text;

  return [...haystack.matchAll(PATTERN)].map((m) => {
    const quote = text.slice(m.index, m.index + m[0].length);
    return { term: quote.toLowerCase(), quote, index: m.index };
  });
}
