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
import { findGaps, parsePeriods, shortTenures, type Gap, type Period } from './dates';
import { findMissingMetrics, type MissingMetricLine } from './metrics';
import { findScopeEvidence, type ScopePanel } from './scope';
import { experienceText, groupAssignedLines, type AssignedSection, type SectionKind } from './sections';

export type Analysis = {
  lines: string[];
  sections: AssignedSection[];
  periods: Period[];
  gaps: Gap[];
  shortTenures: Period[];
  buzzwords: BuzzwordFinding[];
  missingMetrics: MissingMetricLine[];
  /** Vínculos com rótulo reconhecido, do mais antigo para o mais recente. */
  stints: JobStint[];
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
  const periods = parsePeriods(experiencia);
  // Ordem do documento: é ela que diz qual vínculo cobre cada trecho abaixo.
  const stints = extractCompanies(experiencia, periods);

  return {
    lines,
    sections,
    periods,
    gaps: findGaps(periods, { now }),
    shortTenures: shortTenures(periods, { now }),
    buzzwords: findBuzzwords(text),
    missingMetrics: findMissingMetrics(experiencia, stints),
    stints: chronological(stints),
    scope: findScopeEvidence(sections),
  };
}
