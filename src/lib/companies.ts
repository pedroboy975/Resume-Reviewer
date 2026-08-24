/**
 * Rótulo (cargo, empresa, ou os dois) por período de experiência.
 *
 * `dates.ts` só sabe onde está o intervalo de datas, não quem empregou nem
 * em que cargo. Um currículo não tem campo estruturado para isso — mora no
 * texto ao lado da data, e o formato varia bastante:
 *
 * - mesma linha da data ("Empresa X — jan/2020 a atual");
 * - cargo numa linha e empresa na de cima, ou o inverso;
 * - export do LinkedIn: um cabeçalho de empresa cobre vários cargos
 *   seguidos, cada um com sua própria linha de data, às vezes com uma linha
 *   de "N anos M meses" entre o nome da empresa e o primeiro cargo.
 *
 * Não tentamos adivinhar qual trecho é cargo e qual é empresa — separar os
 * dois exigiria inferência que o `CLAUDE.md` proíbe aqui. O que fazemos é
 * achar as linhas de texto ao redor da data e juntá-las na ordem em que
 * aparecem no documento.
 *
 * Isto é heurística sobre texto puro, não modelo: o determinístico vem antes
 * do inferido. Mas por ser heurística, pode não achar nada — quando não
 * acha, o período fica de fora. Nunca inventa um rótulo.
 */

import { monthsBetween, parsePeriods, type Period } from './dates';
import { detectHeading } from './sections';

/** A linha é um intervalo de datas, não nome de cargo nem de empresa. */
const hasPeriod = (line: string) => parsePeriods(line).length > 0;

export type JobStint = {
  label: string;
  period: Period;
};

const MIN_LEN = 2;
const MAX_LEN = 80;

// Linha só com a duração total de uma empresa no export do LinkedIn — nunca
// o nome de nada, mas também não pode travar a busca pela linha de cima.
const DURATION_ONLY = /^\d+\s*anos?(?:\s*(?:e\s*)?\d+\s*mes(?:es)?)?$|^\d+\s*mes(?:es)?$/i;

// Palavras que sobram depois de tirar a data da linha ("Período: jan/2020")
// e não significam nada sozinhas.
const BOILERPLATE = new Set(['periodo', 'duracao', 'data', 'de', 'ate', 'desde', 'presente']);

export const stripAccents = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Início (offset) de cada linha em `text`. */
function lineOffsets(text: string): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const line of text.split('\n')) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }
  return offsets;
}

/** Tira pontuação de borda comum em heading de currículo: "— Empresa X |" → "Empresa X". */
function clean(candidate: string): string {
  return candidate
    .replace(/^[\s|•\-–—:]+/, '')
    .replace(/[\s|•\-–—:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const isBoilerplate = (s: string) => BOILERPLATE.has(stripAccents(s).toLowerCase());

function isCandidate(line: string): boolean {
  const trimmed = clean(line);
  if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) return false;
  if (hasPeriod(line)) return false;
  if (detectHeading(trimmed)) return false;
  if (isBoilerplate(trimmed)) return false;
  return true;
}

/** Texto da própria linha da data, com a data e a duração entre parênteses removidas. */
function sameLineLabel(line: string, period: Period): string | null {
  const stripped = line.replace(period.quote, '').replace(/\(\s*\d[^()]*\)\s*$/, '');
  const trimmed = clean(stripped);
  if (trimmed.length < MIN_LEN || trimmed.length > MAX_LEN) return null;
  if (isBoilerplate(trimmed)) return null;
  return trimmed;
}

/** Um rótulo por período, na ordem em que os períodos aparecem em `text`. */
export function extractCompanies(text: string, periods: Period[]): JobStint[] {
  const lines = text.split('\n');
  const offsets = lineOffsets(text);

  const lineAt = (index: number) => {
    let lo = 0;
    let hi = offsets.length - 1;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (offsets[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const out: JobStint[] = [];
  // "Empresa" cobrindo vários cargos seguidos no export do LinkedIn: sem
  // linha em branco nem nova empresa achada entre um período e o próximo,
  // o nome continua sendo o mesmo de antes.
  let stickyCompany: string | null = null;
  let prevLineIndex = -1;

  for (const period of periods) {
    const lineIndex = lineAt(period.index);

    if (prevLineIndex >= 0) {
      for (let i = prevLineIndex + 1; i < lineIndex; i++) {
        if (lines[i].trim() === '') {
          stickyCompany = null;
          break;
        }
      }
    }

    // Até duas linhas não-vazias, não-data, acima da data — pulando linhas
    // que só têm a duração total ("2 anos 11 meses").
    const above: string[] = [];
    let i = lineIndex - 1;
    while (i >= 0 && above.length < 2) {
      const raw = lines[i];
      if (raw.trim() === '') break;
      if (hasPeriod(raw)) break;
      if (DURATION_ONLY.test(stripAccents(clean(raw)))) {
        i--;
        continue;
      }
      if (!isCandidate(raw)) break;
      above.unshift(clean(raw));
      i--;
    }

    const roleLike = above.length > 0 ? above[above.length - 1] : null;
    const companyLike = above.length > 1 ? above[0] : null;
    const sameLine = sameLineLabel(lines[lineIndex], period);

    let parts: string[];
    if (companyLike) {
      parts = [companyLike, roleLike, sameLine].filter((s): s is string => Boolean(s));
      stickyCompany = companyLike;
    } else if (sameLine) {
      parts = [roleLike, sameLine].filter((s): s is string => Boolean(s));
    } else if (roleLike) {
      parts = stickyCompany ? [stickyCompany, roleLike] : [roleLike];
    } else {
      // Nada acima nem na própria linha: currículo com data seguida do
      // cargo na linha de baixo, em vez de precedida por ele.
      const below = lines[lineIndex + 1];
      parts = below !== undefined && isCandidate(below) ? [clean(below)] : [];
    }

    if (parts.length > 0) out.push({ label: parts.join(' — '), period });
    prevLineIndex = lineIndex;
  }
  return out;
}

/** Mais antigo primeiro — mesma convenção da linha do tempo numérica. */
export function chronological(stints: JobStint[]): JobStint[] {
  return [...stints].sort((a, b) => monthsBetween(b.period.start, a.period.start));
}
