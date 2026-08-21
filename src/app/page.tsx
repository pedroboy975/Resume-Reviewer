'use client';

import { useMemo, useState } from 'react';
import { readPdfText } from '@/lib/pdf-client';
import { findBuzzwords } from '@/lib/buzzwords';
import { redact, type PiiFinding } from '@/lib/pii';
import {
  assignLines,
  experienceText,
  groupAssignedLines,
  type SectionKind,
} from '@/lib/sections';
import { durationMonths, findGaps, parsePeriods, shortTenures } from '@/lib/dates';
import { buildTimeline } from '@/lib/timeline';
import { chronological, extractCompanies } from '@/lib/companies';
import { findMissingMetrics } from '@/lib/metrics';
import { buildDossier, EMPTY_CONTEXT, type CareerContext } from '@/lib/dossier';
import { ContextForm } from '@/components/context-form';
import { MetricAssistant } from '@/components/metric-assistant';
import { PiiPanel } from '@/components/pii-panel';
import { SectionEditor } from '@/components/section-editor';
import { SourcePicker } from '@/components/source-picker';
import { Timeline } from '@/components/timeline';
import { InteractiveSynapseNetwork } from '@/components/ui/interactive-synapse-network';
import { LogoTimeline, type LogoItem } from '@/components/ui/logo-timeline';

/** Reaproveitado por `logoItems` e `missingMetrics` pra não requalificar linha de data. */
const hasPeriod = (line: string) => parsePeriods(line).length > 0;

type Status =
  | { step: 'vazio' }
  | { step: 'lendo'; done: number; total: number }
  | { step: 'pronto' }
  | { step: 'erro'; message: string }
  | { step: 'sem-texto' };

export default function Home() {
  const [status, setStatus] = useState<Status>({ step: 'vazio' });
  const [text, setText] = useState('');
  const [findings, setFindings] = useState<PiiFinding[]>([]);
  const [assignment, setAssignment] = useState<SectionKind[]>([]);
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null);
  const [context, setContext] = useState<CareerContext>(EMPTY_CONTEXT);
  const [jobs, setJobs] = useState<string[]>(['', '']);
  const [metricAnswers, setMetricAnswers] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  /** Redação acontece na entrada. O que fica no estado já está sem PII. */
  function load(raw: string) {
    const redacted = redact(raw);
    setText(redacted.text);
    setFindings(redacted.findings);
    setAssignment(assignLines(redacted.text));
    setSelection(null);
    setMetricAnswers({});
    setStatus({ step: 'pronto' });
  }

  /**
   * PDF escaneado ou só imagem não tem camada de texto: o `pdfjs` devolve
   * páginas com zero itens e nenhum erro. Sem essa checagem, o app mostra
   * "pronto" com timeline vazia e dossiê sem documento — sucesso silencioso
   * sobre um arquivo que na prática não foi lido. Não fazemos OCR aqui.
   */
  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus({ step: 'lendo', done: 0, total: 1 });
    try {
      const text = await readPdfText(file, (done, total) => setStatus({ step: 'lendo', done, total }));
      if (text.trim() === '') {
        setStatus({ step: 'sem-texto' });
        return;
      }
      load(text);
    } catch (e) {
      setStatus({ step: 'erro', message: e instanceof Error ? e.message : String(e) });
    }
  }

  /** Textarea esvaziado volta ao estado inicial, em vez de "pronto" sem nada para mostrar. */
  function onPaste(value: string) {
    if (value.trim() === '') {
      setStatus({ step: 'vazio' });
      return;
    }
    load(value);
  }

  const lines = useMemo(() => text.split('\n'), [text]);
  const sections = useMemo(() => groupAssignedLines(lines, assignment), [lines, assignment]);

  const expText = useMemo(() => experienceText(sections), [sections]);
  const periods = useMemo(() => parsePeriods(expText), [expText]);

  const gaps = useMemo(() => findGaps(periods), [periods]);
  const timeline = useMemo(() => buildTimeline(periods, gaps), [periods, gaps]);

  /**
   * Um marcador por vínculo, mais antigo primeiro. O rótulo (cargo, empresa,
   * ou os dois) vem de `extractCompanies` — heurística sobre as linhas ao
   * lado da data, sem garantia de achar todas. Vínculo em andamento
   * (`period.end === null`) fica em loop; os demais deslizam uma vez e param
   * no fim, porque o vínculo também parou ali.
   */
  const logoItems = useMemo<LogoItem[]>(() => {
    const stints = chronological(extractCompanies(expText, periods, hasPeriod));
    return stints.map((stint, i) => {
      const months = durationMonths(stint.period);
      const duration = Math.min(40, Math.max(10, months / 2));
      return {
        label: stint.label,
        row: i + 1,
        loop: stint.period.end === null,
        // Atraso negativo: o marcador nasce já a meio do trajeto, visível de
        // cara, em vez de começar fora da tela e só aparecer depois de
        // alguns segundos.
        animationDelay: -duration / 2,
        animationDuration: duration,
      };
    });
  }, [expText, periods]);

  const buzzwords = useMemo(() => findBuzzwords(text), [text]);

  const missingMetrics = useMemo(
    () => findMissingMetrics(expText, hasPeriod),
    [expText],
  );

  const metrics = useMemo(
    () => missingMetrics.map((finding) => ({ finding, answer: metricAnswers[finding.quote] ?? '' })),
    [missingMetrics, metricAnswers],
  );

  function onMetricAnswer(quote: string, value: string) {
    setMetricAnswers((current) => ({ ...current, [quote]: value }));
  }

  const dossier = useMemo(
    () =>
      buildDossier({
        context,
        sections,
        pii: findings,
        periods,
        gaps,
        shortTenures: shortTenures(periods),
        buzzwords,
        metrics,
        jobs,
      }),
    [context, sections, findings, periods, gaps, buzzwords, metrics, jobs],
  );

  function onSelect(line: number, extend: boolean) {
    setSelection((current) =>
      extend && current
        ? { from: Math.min(current.from, line), to: Math.max(current.to, line) }
        : { from: line, to: line },
    );
  }

  function onAssign(kind: SectionKind) {
    if (!selection) return;
    setAssignment((current) =>
      current.map((k, i) => (i >= selection.from && i <= selection.to ? kind : k)),
    );
  }

  async function copy() {
    await navigator.clipboard.writeText(dossier);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /**
   * Download client-side: o arquivo é montado na memória do navegador.
   *
   * O link entra no documento antes do clique e a URL só é liberada no tick
   * seguinte. Revogar na mesma linha do `click()` é corrida: o navegador
   * ainda não começou a ler o blob, e o download sai vazio ou nem sai.
   */
  function download() {
    const url = URL.createObjectURL(new Blob([dossier], { type: 'text/markdown' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dossie-carreira.md';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col p-6">
      <InteractiveSynapseNetwork
        nodeCount={50}
        connectionRadius={140}
        trailOpacity={0.22}
        ariaLabel="Fundo decorativo"
        className="border-b border-border"
      >
        <div className="flex flex-col gap-6 p-6">
          <HeroHeader />

          <section className="flex w-fit flex-col gap-3 rounded-lg bg-bg/55 p-4 backdrop-blur-sm">
            <Stage n={1} label="Documento" />
            <SourcePicker
              value={context.artifact}
              onChange={(artifact) => setContext((c) => ({ ...c, artifact }))}
            />

            <label className="flex flex-col gap-2 text-sm text-ink">
              Arquivo em PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => onFile(e.target.files?.[0])}
                className="text-ink-dim file:mr-3 file:rounded file:border-0 file:bg-amber file:px-3 file:py-1.5 file:text-bg file:font-medium"
              />
            </label>

            {status.step === 'lendo' && (
              <p className="font-mono text-sm text-amber" role="status">
                Lendo página {status.done} de {status.total}…
              </p>
            )}
            {status.step === 'erro' && (
              <p className="rounded border border-red/40 bg-red-dim p-3 text-sm text-red">
                Não deu para ler o PDF: {status.message}
              </p>
            )}
            {status.step === 'sem-texto' && (
              <p className="rounded border border-red/40 bg-red-dim p-3 text-sm text-red">
                Não encontramos texto neste PDF. Ele provavelmente é uma versão escaneada ou uma
                imagem — o app lê texto, não imagem, e ainda não faz OCR. Tente exportar de novo a
                partir do documento original, ou cole o texto direto na caixa abaixo.
              </p>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-ink-dim">
                Ou cole o texto direto, sem subir arquivo
              </summary>
              <textarea
                onChange={(e) => onPaste(e.target.value)}
                spellCheck={false}
                placeholder="Cole aqui se preferir não subir o PDF."
                className="mt-2 min-h-40 w-full rounded border border-border bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-dim focus:border-amber focus:outline-none"
              />
            </details>
          </section>
        </div>
      </InteractiveSynapseNetwork>

      {status.step === 'pronto' && (
        <>
          <section className="mt-6 flex flex-col gap-2 border-t border-border pt-6">
            <Stage n={2} label="Dados pessoais" />
            <PiiPanel findings={findings} />
          </section>

          <section className="mt-10 flex flex-col gap-2 border-t border-border pt-8">
            <Stage n={3} label="Linha do tempo" />
            <Timeline data={timeline} />
            {logoItems.length > 0 ? (
              <LogoTimeline items={logoItems} height="240px" showRowSeparator />
            ) : (
              <p className="text-xs text-ink-dim">
                Não identificamos o nome da empresa ao lado de nenhuma data — a linha do tempo
                numérica acima continua completa, só esta versão decorativa fica sem conteúdo.
              </p>
            )}
          </section>

          <section className="mt-10 flex flex-col gap-2 border-t border-border pt-8">
            <Stage n={4} label="Seções" />
            <SectionEditor
              lines={lines}
              assignment={assignment}
              selection={selection}
              onSelect={onSelect}
              onAssign={onAssign}
            />
          </section>

          <section className="mt-10 flex flex-col gap-3 border-t border-border pt-8">
            <Stage n={5} label="Métricas" />
            <MetricAssistant missing={missingMetrics} answers={metricAnswers} onAnswer={onMetricAnswer} />
          </section>

          <section className="mt-10 flex flex-col gap-3 border-t border-border pt-8">
            <Stage n={6} label="Contexto" />
            <ContextForm
              context={context}
              jobs={jobs}
              onContext={setContext}
              onJobs={setJobs}
            />
          </section>

          <section className="mt-10 flex flex-col gap-3 border-t border-border pt-8">
            <Stage n={7} label="Dossiê" />
            <p className="text-sm text-ink-dim">
              Prompt de análise + seu documento + os achados calculados aqui.
              Cole em qualquer chat de IA.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copy}
                className="rounded bg-amber px-3 py-1.5 text-sm font-medium text-bg"
              >
                {copied ? 'Copiado' : 'Copiar dossiê'}
              </button>
              <button
                type="button"
                onClick={download}
                className="rounded border border-border px-3 py-1.5 text-sm text-ink-dim hover:border-amber/40 hover:text-amber"
              >
                Baixar .md
              </button>
              <span className="font-mono text-xs text-ink-dim">
                {dossier.length.toLocaleString('pt-BR')} caracteres
              </span>
            </div>

            <details>
              <summary className="cursor-pointer text-sm text-ink-dim">
                Ver o dossiê antes de copiar
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded border border-border bg-surface p-3 font-mono text-xs whitespace-pre-wrap text-ink">
                {dossier}
              </pre>
            </details>
          </section>
        </>
      )}
    </main>
  );
}

/** Rótulo de etapa: a página é um pipeline real, corrigido em ordem — a numeração carrega essa sequência, não é decoração. */
function Stage({ n, label }: { n: number; label: string }) {
  return (
    <h2 className="flex items-baseline gap-2 text-lg font-semibold text-ink sm:text-xl">
      <span className="font-mono text-sm text-amber">{String(n).padStart(2, '0')}</span>
      {label}
    </h2>
  );
}

/** Cabeçalho da página, num cartão desfocado por cima do fundo de rede. */
function HeroHeader() {
  return (
    <header className="mx-auto flex w-fit max-w-2xl flex-col items-center gap-3 rounded-lg bg-bg/55 px-6 py-8 text-center backdrop-blur-sm">
      <span className="font-mono text-xs tracking-widest text-amber uppercase">Dossiê</span>

      <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
        Profile Auditor Agent
      </h1>

      <p className="text-base font-medium text-ink-dim sm:text-lg">
        Auditoria forense de escopo e dossiê de reconstrução para currículo e LinkedIn.
      </p>

      <div className="inline-flex items-center gap-2 rounded-full border border-green/30 bg-green/10 px-3 py-1.5 text-xs font-medium text-green sm:text-sm">
        <span aria-hidden>🔒</span>
        <span>100% privado: tudo roda no seu navegador, nenhum dado ou arquivo sai do seu dispositivo.</span>
      </div>
    </header>
  );
}
