'use client';

import { Fragment } from 'react';
import type { YearMonth } from '@/lib/dates';
import type { Timeline as TimelineData } from '@/lib/timeline';

const fmt = (ym: YearMonth) => `${String(ym.month).padStart(2, '0')}/${ym.year}`;

const duration = (months: number) => {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years > 0 && `${years}a`, rest > 0 && `${rest}m`].filter(Boolean).join(' ') || '<1m';
};

type Row = {
  gap: boolean;
  label: string;
  detail: string;
  leftPct: number;
  widthPct: number;
};

/**
 * Uma linha por período, do mais antigo ao mais recente, com as lacunas
 * intercaladas como linhas próprias.
 *
 * Cada linha carrega o intervalo escrito: barra sem rótulo não diz nada, e
 * era exatamente o que a primeira versão desta tela mostrava.
 */
export function Timeline({ data }: { data: TimelineData }) {
  if (data.bars.length === 0) {
    return <p className="text-sm text-zinc-500">Nenhum período reconhecido na experiência.</p>;
  }

  const rows: Row[] = [
    ...data.bars.map((bar) => ({
      gap: false,
      label: `${fmt(bar.period.start)} – ${bar.period.end ? fmt(bar.period.end) : 'atual'}`,
      detail: duration(bar.months),
      leftPct: bar.leftPct,
      widthPct: bar.widthPct,
    })),
    ...data.gaps.map((g) => ({
      gap: true,
      label: `${fmt(g.from)} – ${fmt(g.to)}`,
      detail: `lacuna de ${duration(g.months)}`,
      leftPct: g.leftPct,
      widthPct: g.widthPct,
    })),
  ].sort((a, b) => a.leftPct - b.leftPct);

  return (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex justify-between text-zinc-500">
        <span>{fmt(data.from)}</span>
        <span>
          {data.bars.length} períodos · {duration(data.months)} de carreira
        </span>
        <span>{fmt(data.to)}</span>
      </div>

      <div className="grid items-center gap-x-3 gap-y-1 [grid-template-columns:max-content_max-content_1fr]">
        {rows.map((row, i) => (
          // Fragment com três filhos: cada linha ocupa as três colunas do grid
          // externo. Sem wrapper, sem subgrid.
          <Fragment key={i}>
            <span
              className={`tabular-nums ${row.gap ? 'text-red-600 dark:text-red-400' : 'text-zinc-500'}`}
            >
              {row.label}
            </span>
            <span className={row.gap ? 'text-red-600 dark:text-red-400' : 'text-zinc-400'}>
              {row.detail}
            </span>
            <div className="relative h-5">
              <div
                className={
                  row.gap
                    ? 'absolute h-5 rounded border border-dashed border-red-400 bg-red-500/10'
                    : 'absolute h-5 rounded bg-zinc-800 dark:bg-zinc-200'
                }
                style={{ left: `${row.leftPct}%`, width: `${row.widthPct}%` }}
              />
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
