'use client';

import { AXES, AXIS_EMPTY, AXIS_LABEL, type ScopePanel as Panel } from '@/lib/scope';

/**
 * Os trechos que sustentam cada eixo de escopo.
 *
 * O painel é de leitura, não de decisão: não há nível, nem nota, nem
 * contagem ao lado do eixo. Ver `src/lib/scope.ts` para o porquê de cada
 * uma dessas ausências ser deliberada.
 */
export function ScopePanel({ panel }: { panel: Panel }) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-dim">
        Trechos citados do seu documento, agrupados por eixo. Não é uma
        classificação de nível — é o material para que a IA classifique
        olhando o que o documento comprova, e não o cargo.
      </p>

      <div className="flex flex-col gap-4">
        <h3 className="font-mono text-xs uppercase tracking-wide text-amber">
          Comprovado <span className="text-ink-dim">— dentro da Experiência</span>
        </h3>
        {AXES.map((axis) => {
          const found = panel.proven.filter((e) => e.axis === axis);
          return (
            <div key={axis} className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-ink">{AXIS_LABEL[axis]}</p>
              {found.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {found.map((e, i) => (
                    <li
                      key={i}
                      className="border-l-2 border-amber-dim pl-3 text-sm text-ink-dim"
                    >
                      {e.quote}
                    </li>
                  ))}
                </ul>
              ) : (
                /* Ausência é sempre do detector, nunca da carreira. */
                <p className="text-sm text-ink-dim">{AXIS_EMPTY[axis]}</p>
              )}
            </div>
          );
        })}
      </div>

      {panel.claimed.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <h3 className="font-mono text-xs uppercase tracking-wide text-amber">
            Declarado{' '}
            <span className="text-ink-dim">— fora da Experiência, sem vínculo</span>
          </h3>
          <ul className="flex flex-col gap-1">
            {panel.claimed.map((e, i) => (
              <li key={i} className="border-l-2 border-red-dim pl-3 text-sm text-ink-dim">
                <span className="text-ink">{AXIS_LABEL[e.axis]}:</span> {e.quote}
              </li>
            ))}
          </ul>
        </div>
      )}

      {panel.unclassified.length > 0 && (
        <details className="flex flex-col gap-1.5">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide text-ink-dim">
            Não classificado ({panel.unclassified.length})
          </summary>
          <p className="mt-2 text-xs text-ink-dim">
            O aplicativo não reconheceu sinal de escopo nestas linhas. Isso não
            significa que não haja — redação em voz passiva escapa da lista de
            termos. Elas não vão para o dossiê separadas, mas o texto completo
            da Experiência vai.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {panel.unclassified.map((line, i) => (
              <li key={i} className="border-l-2 border-border pl-3 text-sm text-ink-dim">
                {line}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
