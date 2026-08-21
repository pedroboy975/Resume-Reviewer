/**
 * Geometria da linha do tempo.
 *
 * Cálculo separado do componente para poder ser testado sem React: barra que
 * some ou lacuna no lugar errado é erro de aritmética, não de CSS.
 */

import { monthsBetween, toYearMonth, type Gap, type Period, type YearMonth } from './dates';

export type Bar = {
  period: Period;
  /** Posição e largura em porcentagem da faixa total. */
  leftPct: number;
  widthPct: number;
  months: number;
};

export type GapBar = Gap & { leftPct: number; widthPct: number };

export type Timeline = {
  from: YearMonth;
  to: YearMonth;
  months: number;
  bars: Bar[];
  gaps: GapBar[];
};

const earliest = (a: YearMonth, b: YearMonth) => (monthsBetween(a, b) < 0 ? b : a);
const latest = (a: YearMonth, b: YearMonth) => (monthsBetween(a, b) > 0 ? b : a);

/**
 * Faixa que cobre todos os períodos, com cada barra posicionada dentro dela.
 *
 * Período de um mês só ainda precisa ser visível: a largura mínima é de 1%.
 */
export function buildTimeline(
  periods: Period[],
  gaps: Gap[] = [],
  { now = new Date() }: { now?: Date } = {},
): Timeline {
  const today = toYearMonth(now);
  if (periods.length === 0) {
    return { from: today, to: today, months: 0, bars: [], gaps: [] };
  }

  const ends = periods.map((p) => p.end ?? today);
  const from = periods.map((p) => p.start).reduce(earliest);
  const to = ends.reduce(latest);
  const months = Math.max(1, monthsBetween(from, to));

  const place = (start: YearMonth, end: YearMonth) => ({
    leftPct: (monthsBetween(from, start) / months) * 100,
    widthPct: Math.max(1, (monthsBetween(start, end) / months) * 100),
  });

  // Do mais antigo para o mais recente. O documento costuma vir ao contrário
  // (LinkedIn lista o emprego atual primeiro), e ler carreira de baixo para
  // cima não ajuda ninguém.
  const ordered = periods
    .map((period, i) => ({ period, end: ends[i] }))
    .sort((a, b) => monthsBetween(b.period.start, a.period.start));

  return {
    from,
    to,
    months,
    bars: ordered.map(({ period, end }) => ({
      period,
      months: monthsBetween(period.start, end),
      ...place(period.start, end),
    })),
    gaps: gaps.map((gap) => ({ ...gap, ...place(gap.from, gap.to) })),
  };
}
