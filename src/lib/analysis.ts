/**
 * Tudo que se deriva de um documento, numa chamada só.
 *
 * A ordem desta cadeia é conhecimento de domínio, não de interface: seções
 * saem das linhas atribuídas, períodos saem só do texto de Experiência,
 * lacunas e permanências curtas saem dos períodos. Antes deste módulo essa
 * ordem vivia dentro de um componente React e era reconstruída à mão em
 * `tests/pipeline.test.ts` — as duas cópias já tinham divergido no `now`, e
 * o teste de ponta a ponta deixou de exercitar o que a página faz.
 *
 * `assignment` entra como parâmetro porque é editável: corrigir o fatiamento
 * é parte do fluxo (ver CLAUDE.md > "o parser vai errar"), e cada correção
 * refaz a análise inteira.
 *
 * `now` é injetado para o teste poder fixar a data. Período em andamento é
 * medido até hoje, e sem isso o resultado muda a cada dia que passa.
 */

import { findBuzzwords, type BuzzwordFinding } from './buzzwords';
import { chronological, extractCompanies, type JobStint } from './companies';
import {
  chronological as chronologicalPeriods,
  findGaps,
  findOverlaps,
  parsePeriods,
  shortTenures,
  type Gap,
  type Overlap,
  type Period,
} from './dates';
import { findMissingMetrics, silentStints, type MissingMetricLine } from './metrics';
import { findScopeEvidence, type ScopePanel } from './scope';
import { experienceText, groupAssignedLines, type AssignedSection, type SectionKind } from './sections';

export type Analysis = {
  lines: string[];
  sections: AssignedSection[];
  /** Mais antigo primeiro. O documento raramente vem nessa ordem. */
  periods: Period[];
  gaps: Gap[];
  shortTenures: Period[];
  /** Pares de períodos que correm ao mesmo tempo. Não é veredito: é pergunta. */
  overlaps: Overlap[];
  buzzwords: BuzzwordFinding[];
  missingMetrics: MissingMetricLine[];
  /** Vínculos com rótulo reconhecido, do mais antigo para o mais recente. */
  stints: JobStint[];
  /** Vínculos sem nenhuma linha de descrição abaixo da data. */
  silentStints: JobStint[];
  /** Trechos que sustentam cada eixo de escopo. Não é veredito de nível. */
  scope: ScopePanel;
};

/**
 * O documento inteiro, analisado.
 *
 * `text` já deve vir redigido: nenhum módulo daqui para baixo deve ver dado
 * pessoal. Ver CLAUDE.md > PII.
 */
export function analyze(
  text: string,
  assignment: SectionKind[],
  { now = new Date() }: { now?: Date } = {},
): Analysis {
  const lines = text.split('\n');
  const sections = groupAssignedLines(lines, assignment);

  // Datas de formação ou de certificado abririam lacuna de emprego que não
  // existe: só o que a pessoa atribuiu a Experiência entra na aritmética.
  const experiencia = experienceText(sections);
  // Ordem do documento: é ela que diz qual vínculo cobre cada trecho abaixo.
  const inDocument = parsePeriods(experiencia);
  const stints = extractCompanies(experiencia, inDocument);

  return {
    lines,
    sections,
    periods: chronologicalPeriods(inDocument),
    gaps: findGaps(inDocument, { now }),
    shortTenures: shortTenures(inDocument, { now }),
    overlaps: findOverlaps(inDocument, { now }),
    buzzwords: findBuzzwords(text),
    missingMetrics: findMissingMetrics(experiencia, stints),
    stints: chronological(stints),
    silentStints: chronological(silentStints(experiencia, stints)),
    scope: findScopeEvidence(sections),
  };
}
