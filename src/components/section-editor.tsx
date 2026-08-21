'use client';

import { groupAssignedLines, SECTION_LABEL, type SectionKind } from '@/lib/sections';

const KINDS = Object.keys(SECTION_LABEL) as SectionKind[];

type Props = {
  lines: string[];
  assignment: SectionKind[];
  selection: { from: number; to: number } | null;
  onSelect: (line: number, extend: boolean) => void;
  onAssign: (kind: SectionKind) => void;
};

/**
 * Texto extraído à esquerda, seções montadas à direita.
 *
 * O parser erra — é o pressuposto do Sprint 3, não uma falha. Corrigir é
 * clicar na linha (shift+clique estende) e escolher a seção certa.
 */
export function SectionEditor({ lines, assignment, selection, onSelect, onAssign }: Props) {
  const selected = (i: number) => selection !== null && i >= selection.from && i <= selection.to;
  const groups = groupAssignedLines(lines, assignment);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-zinc-500">
          {selection
            ? `Linhas ${selection.from + 1}–${selection.to + 1} → mover para:`
            : 'Clique numa linha à esquerda (shift+clique estende a seleção).'}
        </span>
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            disabled={selection === null}
            onClick={() => onAssign(kind)}
            className="rounded border border-zinc-300 px-2 py-1 text-xs enabled:hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:enabled:hover:bg-zinc-900"
          >
            {SECTION_LABEL[kind]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ol className="max-h-[32rem] overflow-y-auto rounded border border-zinc-300 font-mono text-xs dark:border-zinc-700">
          {lines.map((line, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={(e) => onSelect(i, e.shiftKey)}
                className={`flex w-full gap-2 px-2 py-0.5 text-left ${
                  selected(i) ? 'bg-blue-100 dark:bg-blue-950' : 'hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                <span className="w-8 shrink-0 text-right text-zinc-400">{i + 1}</span>
                <span className="w-24 shrink-0 truncate text-zinc-400">
                  {SECTION_LABEL[assignment[i]]}
                </span>
                <span className="whitespace-pre-wrap break-words">{line || ' '}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="max-h-[32rem] overflow-y-auto rounded border border-zinc-300 dark:border-zinc-700">
          {groups.map((group, i) => (
            <section key={i} className="border-b border-zinc-200 p-3 last:border-0 dark:border-zinc-800">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {SECTION_LABEL[group.kind]}
                <span className="ml-2 font-normal normal-case opacity-60">
                  linhas {group.from + 1}–{group.to + 1}
                </span>
              </h3>
              <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-xs">
                {group.text.trim() || '(vazia)'}
              </pre>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
