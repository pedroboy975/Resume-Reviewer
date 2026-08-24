'use client';

import { METRIC_QUESTIONS, metricKey, type MissingMetricLine } from '@/lib/metrics';

type Props = {
  missing: MissingMetricLine[];
  answers: Record<string, string>;
  onAnswer: (key: string, value: string) => void;
};

/**
 * Um bullet sem número por cartão, com as três perguntas fixas do
 * CLAUDE.md > Fase 3 ao lado. A resposta vira número confirmado no dossiê —
 * o app não estima nada, só pergunta.
 */
export function MetricAssistant({ missing, answers, onAnswer }: Props) {
  if (missing.length === 0) {
    return (
      <p className="text-sm text-ink-dim">
        Nenhum resultado sem número nos bullets de experiência.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-dim">
        Os trechos abaixo descrevem resultado sem nenhum número por perto. Sem resposta, o
        dossiê marca como <code className="text-amber">[FALTA NÚMERO]</code> — não precisa ser
        exato, qualquer coisa concreta já ajuda.
      </p>

      {missing.map((m) => (
        <div
          key={metricKey(m)}
          className="flex flex-col gap-2 rounded border border-border bg-surface p-3"
        >
          {/* O vínculo primeiro: é o que diz de qual emprego é este trecho
              quando a mesma atividade se repete em empresas diferentes. */}
          {m.label && (
            <p
              title={m.label}
              className="truncate text-right font-mono text-[11px] uppercase tracking-wide text-amber"
            >
              {m.label}
            </p>
          )}
          <p className="text-xs text-ink-dim italic">&ldquo;{m.quote}&rdquo;</p>

          <ul className="flex flex-col gap-1 text-xs text-ink-dim">
            {Object.values(METRIC_QUESTIONS).map((q) => (
              <li key={q.label}>
                <span className="text-amber">{q.label}:</span> {q.question}
              </li>
            ))}
          </ul>

          <textarea
            value={answers[metricKey(m)] ?? ''}
            onChange={(e) => onAnswer(metricKey(m), e.target.value)}
            placeholder="Responda uma ou mais perguntas acima, com o número real."
            className="min-h-16 rounded border border-border bg-bg p-2 font-mono text-xs text-ink placeholder:text-ink-dim focus:border-amber focus:outline-none"
          />
        </div>
      ))}
    </div>
  );
}
