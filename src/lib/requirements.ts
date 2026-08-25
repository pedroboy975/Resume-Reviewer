/**
 * Requisitos duros do texto de uma vaga, com a modalidade preservada.
 *
 * O que motivou o módulo foram três falhas na mesma rodada de teste, em duas
 * direções opostas:
 *
 * - a vaga exigia "Mínimo de 12 anos" e a pessoa tinha 10 anos e 10 meses; a
 *   saída declarou que ela "atende a todos os pré-requisitos mandatórios";
 * - a vaga dizia, literalmente, "Certificação CFP, CEA ou CGA (diferencial)",
 *   e a saída afirmou "ausência das certificações **obrigatórias**" — inventou
 *   um critério de corte que o texto colado contradiz;
 * - a vaga exigia graduação em Economia, Administração ou Engenharia, a
 *   formação era Relações Internacionais, e isso não apareceu em lugar nenhum.
 *
 * Os três se resolvem no mesmo lugar: extrair o requisito com a **palavra que
 * o texto usou** para qualificá-lo. "Diferencial" e "obrigatório" mudam tudo,
 * e o modelo não pode escolher qual dos dois leu.
 *
 * O que este módulo **não** faz: decidir se a pessoa atende. Comparar 10a10m
 * com 12 anos é subtração e sai daqui; decidir se faltam catorze meses
 * eliminam a candidatura é julgamento de mercado, e é do modelo. Ver
 * CLAUDE.md > Split determinístico.
 */

import { stripAccents } from './companies';

/** A palavra que a vaga usou para qualificar o requisito. */
export type Modality = 'obrigatório' | 'desejável' | 'diferencial' | 'não declarada';

export type RequirementKind = 'anos' | 'formacao' | 'certificacao' | 'idioma';

export type Requirement = {
  kind: RequirementKind;
  /** Trecho verbatim da vaga. Ver CLAUDE.md > Citação obrigatória. */
  quote: string;
  modality: Modality;
  /** Só em `anos`: o número exigido. */
  years?: number;
};

export const KIND_LABEL: Record<RequirementKind, string> = {
  anos: 'Tempo de experiência',
  formacao: 'Formação',
  certificacao: 'Certificação',
  idioma: 'Idioma',
};

/**
 * A modalidade é lida da frase inteira, não de uma palavra colada ao termo.
 * "(diferencial)" costuma vir no fim da linha, longe do nome do certificado.
 *
 * A ordem é de desempate, e na dúvida vence a modalidade mais fraca. Inventar
 * uma obrigação é a falha que já aconteceu — "diferencial" no texto virou
 * "certificações obrigatórias" na saída — e é a mais cara das duas: uma
 * exigência inventada elimina a pessoa de uma vaga que ela poderia disputar.
 */
const MODALITIES: [Modality, RegExp][] = [
  ['diferencial', /\bdiferencial|\bser[áa] um plus\b|\bplus\b/i],
  ['desejável', /\bdesej[áa]v|\bpreferencial|\bvalorizad|\bser[áa] um diferencial\b/i],
  [
    'obrigatório',
    // "Mínimo de 12 anos" declara a obrigação sem usar a palavra: o piso é o
    // corte. Foi essa a frase que a saída leu como atendida.
    /\bobrigat[óo]ri|\bmandat[óo]ri|\bimprescind[íi]v|\bnecess[áa]ri|\bexigid|\bexige\b|\bm[íi]nimo de\b|\bno m[íi]nimo\b|\bpelo menos\b/i,
  ],
];

function modalityOf(sentence: string): Modality {
  for (const [modality, pattern] of MODALITIES) {
    if (pattern.test(sentence)) return modality;
  }
  return 'não declarada';
}

/**
 * "Mínimo de 12 anos", "12+ anos de experiência", "acima de 8 anos na área".
 *
 * O número precisa estar amarrado a "anos" e a experiência, senão qualquer
 * "empresa com 30 anos de mercado" viraria requisito de senioridade.
 */
const YEARS =
  /(\d{1,2})\s*\+?\s*anos?\b(?=[^.;\n]{0,40}\b(?:experi[êe]ncia|atua[çc][ãa]o|vivência|vivencia|carreira|mercado de trabalho|na [áa]rea|no setor|em (?:posi|cargo)))/i;

const FORMACAO =
  /\b(?:gradua[çc][ãa]o|ensino superior|forma[çc][ãa]o superior|bacharel|licenciatura|p[óo]s-?gradua[çc][ãa]o|mba|mestrado|doutorado|superior completo)\b/i;

/**
 * Certificação nomeada. Sigla em caixa alta é o formato do mercado — CPA-20,
 * CFP, CEA, PMP, CFA, ITIL —, e o nome por extenso quase nunca aparece sem
 * ela ao lado.
 */
const CERTIFICACAO = /\b(?:certifica[çc][ãa]o|certificad[oa]s?|registro|credenciamento)\b/i;
const ACRONYM = /\b[A-Z]{2,6}(?:-\d{1,3})?\b/g;

const IDIOMA = /\b(?:ingl[êe]s|espanhol|franc[êe]s|alem[ãa]o|italiano|mandarim|idiomas?)\b/i;

/** Frases da vaga, uma por linha ou por pontuação forte. */
const cut = (text: string): string[] =>
  text
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s !== '');

/** Requisitos duros de uma vaga, na ordem em que aparecem. */
export function findRequirements(job: string): Requirement[] {
  const out: Requirement[] = [];

  for (const quote of cut(job)) {
    const modality = modalityOf(quote);

    const years = YEARS.exec(quote);
    if (years) out.push({ kind: 'anos', quote, modality, years: Number(years[1]) });
    if (FORMACAO.test(quote)) out.push({ kind: 'formacao', quote, modality });
    if (CERTIFICACAO.test(quote)) out.push({ kind: 'certificacao', quote, modality });
    if (IDIOMA.test(quote)) out.push({ kind: 'idioma', quote, modality });
  }

  return out;
}

/**
 * As siglas de certificação citadas na frase, para poder dizer se aparecem no
 * documento sem depender de o modelo relê-las corretamente.
 */
export const acronymsIn = (quote: string): string[] => [
  ...new Set((quote.match(ACRONYM) ?? []).filter((a) => a.length >= 2)),
];

/** A sigla aparece literalmente no documento da pessoa. */
export const inDocument = (document: string, term: string): boolean =>
  new RegExp(`\\b${stripAccents(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
    stripAccents(document),
  );
