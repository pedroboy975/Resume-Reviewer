'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export interface InteractiveSynapseNetworkProps {
  /** Conteúdo renderizado por cima do canvas. */
  children?: ReactNode;
  /** Cor de cada nó (qualquer valor aceito por `ctx.fillStyle`). */
  nodeColor?: string;
  /** Cor do pulso que percorre uma conexão. */
  pulseColor?: string;
  /** Cor das linhas de conexão entre nós. */
  connectionColor?: string;
  /** Cor do preenchimento que cria o rastro (deve ser opaca; a opacidade vem de `trailOpacity`). */
  trailColor?: string;
  /** Quantos nós simular. */
  nodeCount?: number;
  /** Distância máxima (px) para formar uma conexão. */
  connectionRadius?: number;
  /** Opacidade do rastro de fundo a cada frame (0–1). */
  trailOpacity?: number;
  /** Rótulo ARIA para leitores de tela. */
  ariaLabel?: string;
  /** Classes adicionais no wrapper. */
  className?: string;
}

interface NodeState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  connections: NodeState[];
  pulses: PulseState[];
  activation: number;
}

interface PulseState {
  start: NodeState;
  end: NodeState;
  progress: number;
}

const PULSE_SPEED = 0.03;

function makeNode(width: number, height: number): NodeState {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    radius: Math.random() * 2 + 2,
    connections: [],
    pulses: [],
    activation: 0,
  };
}

/**
 * Rede de nós conectados que reage ao cursor, contida no elemento que a
 * envolve (não na janela). O tamanho do canvas e as coordenadas do mouse são
 * relativos ao wrapper via `ResizeObserver` e `getBoundingClientRect` — assim
 * o componente pode ficar atrás de uma seção específica em vez de cobrir a
 * página inteira.
 *
 * Se `prefers-reduced-motion` estiver ativo, desenha um quadro estático (nós
 * e conexões, sem pulso nem rastro) e não registra o listener de mouse.
 */
export function InteractiveSynapseNetwork({
  children,
  nodeColor = 'var(--color-amber)',
  pulseColor = 'var(--color-ink)',
  connectionColor = 'var(--color-amber)',
  trailColor = 'var(--color-bg)',
  nodeCount = 50,
  connectionRadius = 200,
  trailOpacity = 0.2,
  ariaLabel = 'Rede de nós interativa',
  className = '',
}: InteractiveSynapseNetworkProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    /**
     * `ctx.fillStyle`/`strokeStyle` não resolvem `var(--token)` como o DOM
     * resolve — a atribuição é silenciosamente ignorada e o canvas mantém a
     * cor anterior (preto, por padrão). Resolvemos para o valor computado
     * uma vez, aqui, antes de qualquer desenho.
     */
    const resolveColor = (value: string) => {
      const match = value.match(/^var\((--[\w-]+)\)$/);
      if (!match) return value;
      const resolved = getComputedStyle(wrapper).getPropertyValue(match[1]).trim();
      return resolved || value;
    };
    const resolvedNodeColor = resolveColor(nodeColor);
    const resolvedPulseColor = resolveColor(pulseColor);
    const resolvedConnectionColor = resolveColor(connectionColor);
    const resolvedTrailColor = resolveColor(trailColor);

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = { x: -9999, y: -9999 };
    let width = 0;
    let height = 0;
    let nodes: NodeState[] = [];
    let rafId = 0;

    function connect() {
      nodes.forEach((n1) => {
        n1.connections = nodes.filter(
          (n2) => n2 !== n1 && Math.hypot(n1.x - n2.x, n1.y - n2.y) < connectionRadius,
        );
      });
    }

    function resize() {
      if (!canvas) return;
      const rect = wrapper!.getBoundingClientRect();
      width = canvas.width = rect.width;
      height = canvas.height = rect.height;
      nodes = Array.from({ length: nodeCount }, () => makeNode(width, height));
      connect();
    }

    function updateNode(node: NodeState) {
      node.x += node.vx;
      node.y += node.vy;
      if (node.x < 0 || node.x > width) node.vx *= -1;
      if (node.y < 0 || node.y > height) node.vy *= -1;

      const dist = Math.hypot(node.x - mouse.x, node.y - mouse.y);
      const target = Math.max(0, 1 - dist / (connectionRadius * 0.8));
      node.activation += (target - node.activation) * 0.1;

      if (node.activation > 0.5 && Math.random() > 0.98 && node.connections.length > 0) {
        const end = node.connections[Math.floor(Math.random() * node.connections.length)];
        node.pulses.push({ start: node, end, progress: 0 });
      }

      node.pulses = node.pulses.filter((p) => p.progress < 1);
      node.pulses.forEach((p) => (p.progress += PULSE_SPEED));
    }

    function drawNode(node: NodeState) {
      if (!ctx) return;
      ctx.globalAlpha = Math.max(0.2, node.activation);
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fillStyle = resolvedNodeColor;
      ctx.fill();
      ctx.globalAlpha = 1;

      node.pulses.forEach((p) => {
        const x = p.start.x + (p.end.x - p.start.x) * p.progress;
        const y = p.start.y + (p.end.y - p.start.y) * p.progress;
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = resolvedPulseColor;
        ctx.fill();
      });
    }

    function frame() {
      if (!ctx) return;
      ctx.globalAlpha = trailOpacity;
      ctx.fillStyle = resolvedTrailColor;
      ctx.fillRect(0, 0, width, height);
      ctx.globalAlpha = 1;

      nodes.forEach((n1) => {
        n1.connections.forEach((n2) => {
          const a = Math.max(0.05, n1.activation, n2.activation) * 0.2;
          ctx.globalAlpha = a;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = resolvedConnectionColor;
          ctx.stroke();
        });
      });
      ctx.globalAlpha = 1;

      nodes.forEach((n) => {
        updateNode(n);
        drawNode(n);
      });

      rafId = requestAnimationFrame(frame);
    }

    function drawStaticFrame() {
      if (!ctx) return;
      ctx.fillStyle = resolvedTrailColor;
      ctx.fillRect(0, 0, width, height);

      nodes.forEach((n1) => {
        n1.connections.forEach((n2) => {
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.moveTo(n1.x, n1.y);
          ctx.lineTo(n2.x, n2.y);
          ctx.strokeStyle = resolvedConnectionColor;
          ctx.stroke();
        });
      });
      ctx.globalAlpha = 1;

      nodes.forEach((n) => {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
        ctx.fillStyle = resolvedNodeColor;
        ctx.fill();
      });
    }

    resize();

    if (reduceMotion) {
      drawStaticFrame();
    } else {
      const onMouseMove = (e: MouseEvent) => {
        const rect = wrapper!.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      };
      const onMouseLeave = () => {
        mouse.x = -9999;
        mouse.y = -9999;
      };
      wrapper.addEventListener('mousemove', onMouseMove);
      wrapper.addEventListener('mouseleave', onMouseLeave);

      const observer = new ResizeObserver(resize);
      observer.observe(wrapper);

      frame();

      return () => {
        cancelAnimationFrame(rafId);
        wrapper.removeEventListener('mousemove', onMouseMove);
        wrapper.removeEventListener('mouseleave', onMouseLeave);
        observer.disconnect();
      };
    }

    const observer = new ResizeObserver(() => {
      resize();
      drawStaticFrame();
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [nodeColor, pulseColor, connectionColor, trailColor, nodeCount, connectionRadius, trailOpacity]);

  return (
    <div
      ref={wrapperRef}
      role="img"
      aria-label={ariaLabel}
      className={`relative overflow-hidden ${className}`}
    >
      <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 block h-full w-full" />
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}

export default InteractiveSynapseNetwork;
