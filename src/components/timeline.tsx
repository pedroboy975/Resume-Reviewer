'use client';

import type { YearMonth } from '@/lib/dates';
import type { Timeline as TimelineData } from '@/lib/timeline';

const fmt = (ym: YearMonth) => `${String(ym.month).padStart(2, '0')}/${ym.year}`;

const duration = (months: number) => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years > 0 && `${years} a`, rest > 0 && `${rest} m`].filter(Boolean).join(' ') || '< 1 m';
};

/** Barras de emprego sobre a faixa da carreira, com as lacunas marcadas. */
export function Timeline({ data }: { data: TimelineData }) {
  if (data.bars.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhum período reconhecido na experiência.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{fmt(data.from)}</span>
        <span>{fmt(data.to)}</span>
      </div>

      <div className="relative flex flex-col gap-1">
        {data.gaps.map((gap, i) => (
          <div
            key={`gap-${i}`}
            title={`Lacuna de ${duration(gap.months)}`}
            className="absolute inset-y-0 border-x border-dashed border-red-400 bg-red-500/10"
            style={{ left: `${gap.leftPct}%`, width: `${gap.widthPct}%` }}
          />
        ))}

        {data.bars.map((bar, i) => (
          <div key={i} className="relative h-6">
            <div
              className="absolute top-0 h-6 rounded bg-zinc-800 dark:bg-zinc-200"
              style={{ left: `${bar.leftPct}%`, width: `${bar.widthPct}%` }}
              title={`${bar.period.quote} — ${duration(bar.months)}`}
            />
          </div>
        ))}
      </div>

      {data.gaps.length > 0 && (
        <ul className="text-xs text-red-700 dark:text-red-300">
          {data.gaps.map((gap, i) => (
            <li key={i}>
              Lacuna de {duration(gap.months)} entre {fmt(gap.from)} e {fmt(gap.to)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
