'use client';

import { useState, type ReactNode } from 'react';

export interface LogoItem {
  /** Texto exibido ao lado do marcador. */
  label: string;
  /** Marcador opcional à esquerda do texto. Sem ele, um ponto âmbar é desenhado no tamanho de `iconSize`. */
  icon?: ReactNode;
  /** Atraso da animação, em segundos (negativo para efeito escalonado). */
  animationDelay: number;
  /** Duração da animação, em segundos. */
  animationDuration: number;
  /** Linha (1-based) onde o item aparece. */
  row: number;
  /**
   * `true` para o item correr em loop (o vínculo ainda está ativo).
   * `false`/ausente: a animação roda uma vez e para no fim — o vínculo
   * acabou, então o marcador não continua a se mover para sempre.
   */
  loop?: boolean;
}

export interface LogoTimelineProps {
  items: LogoItem[];
  /** Texto opcional exibido, bem apagado, atrás das linhas. */
  title?: string;
  /** Altura do contêiner, como valor CSS (`"320px"`, `"20rem"`...). */
  height?: string;
  className?: string;
  /** Tamanho do marcador em pixels quando `icon` não é passado (padrão: 8). */
  iconSize?: number;
  showRowSeparator?: boolean;
  /** Anima só quando o cursor está sobre o componente (padrão: false). */
  animateOnHover?: boolean;
}

/**
 * Linha do tempo horizontal com um marcador por linha, cada um deslizando da
 * esquerda para a direita.
 *
 * Adaptado do componente `logo-timeline` de terceiros: sem `motion` (o
 * original usava `motion.div` sem nenhuma prop de animação — CSS puro já
 * fazia todo o trabalho) e sem `cn()`/`@/lib/utils` (o projeto não tem essa
 * dependência e não precisa dela para strings de classe fixas). Cores vêm
 * dos tokens do projeto, não de `bg-background`/`text-foreground`.
 */
export function LogoTimeline({
  items,
  title,
  height = '320px',
  className = '',
  iconSize = 8,
  showRowSeparator = true,
  animateOnHover = false,
}: LogoTimelineProps) {
  const [isHovered, setIsHovered] = useState(false);

  const rowsMap = new Map<number, LogoItem[]>();
  items.forEach((item) => {
    if (!rowsMap.has(item.row)) rowsMap.set(item.row, []);
    rowsMap.get(item.row)?.push(item);
  });
  const rows = Array.from(rowsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, rowItems]) => rowItems);

  const animationPlayState = animateOnHover ? (isHovered ? 'running' : 'paused') : 'running';

  if (rows.length === 0) return null;

  return (
    <section className={`w-full ${className}`}>
      <div
        aria-hidden="true"
        className="relative w-full overflow-hidden bg-bg py-8"
        style={{ height }}
        onMouseEnter={() => animateOnHover && setIsHovered(true)}
        onMouseLeave={() => animateOnHover && setIsHovered(false)}
      >
        {title && (
          <div className="absolute top-1/2 left-1/2 mx-auto w-full max-w-[90%] -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-ink/10 sm:text-5xl">
              {title}
            </p>
          </div>
        )}

        <div
          className="@container absolute inset-0 grid"
          style={{ gridTemplateRows: `repeat(${rows.length}, 1fr)` }}
        >
          {rows.map((rowItems, index) => (
            <div className="group relative flex items-center" key={index}>
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              {showRowSeparator && (
                <div className="absolute inset-x-0 bottom-0 h-px bg-border/60 group-last:hidden" />
              )}
              {rowItems.map((logo) => (
                <div
                  key={`${logo.row}-${logo.label}`}
                  className="timeline-pill absolute top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 whitespace-nowrap [animation-name:move-x] [animation-timing-function:linear] [--move-x-from:-100%] [--move-x-to:calc(100%+100cqw)]"
                  style={{
                    animationDelay: `${logo.animationDelay}s`,
                    animationDuration: `${logo.animationDuration}s`,
                    animationPlayState,
                    animationIterationCount: logo.loop ? 'infinite' : 1,
                    animationFillMode: logo.loop ? 'none' : 'forwards',
                  }}
                >
                  {logo.icon ?? (
                    <span
                      aria-hidden
                      className="shrink-0 rounded-full bg-amber"
                      style={{ width: iconSize, height: iconSize }}
                    />
                  )}
                  <span className="font-mono text-sm text-ink">{logo.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default LogoTimeline;
