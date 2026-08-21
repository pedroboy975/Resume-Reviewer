'use client';

import { useMemo, useState } from 'react';
import { readPdfText } from '@/lib/pdf-client';
import { redact, type PiiFinding } from '@/lib/pii';
import {
  assignLines,
  experienceText,
  groupAssignedLines,
  type SectionKind,
} from '@/lib/sections';
import { findGaps, parsePeriods, shortTenures } from '@/lib/dates';
import { buildTimeline } from '@/lib/timeline';
import { buildDossier, EMPTY_CONTEXT, type CareerContext } from '@/lib/dossier';
import { ContextForm } from '@/components/context-form';
import { PiiPanel } from '@/components/pii-panel';
import { SectionEditor } from '@/components/section-editor';
import { Timeline } from '@/components/timeline';

type Status =
  | { step: 'vazio' }
  | { step: 'lendo'; done: number; total: number }
  | { step: 'pronto' }
  | { step: 'erro'; message: string };

export default function Home() {
  const [status, setStatus] = useState<Status>({ step: 'vazio' });
  const [text, setText] = useState('');
  const [findings, setFindings] = useState<PiiFinding[]>([]);
  const [assignment, setAssignment] = useState<SectionKind[]>([]);
  const [selection, setSelection] = useState<{ from: number; to: number } | null>(null);
  const [context, setContext] = useState<CareerContext>(EMPTY_CONTEXT);
  const [jobs, setJobs] = useState<string[]>(['', '']);
  const [copied, setCopied] = useState(false);

  /** Redação acontece na entrada. O que fica no estado já está sem PII. */
  function load(raw: string) {
    const redacted = redact(raw);
    setText(redacted.text);
    setFindings(redacted.findings);
    setAssignment(assignLines(redacted.text));
    setSelection(null);
    setStatus({ step: 'pronto' });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setStatus({ step: 'lendo', done: 0, total: 1 });
    try {
      load(await readPdfText(file, (done, total) => setStatus({ step: 'lendo', done, total })));
    } catch (e) {
      setStatus({ step: 'erro', message: e instanceof Error ? e.message : String(e) });
    }
  }

  const lines = useMemo(() => text.split('\n'), [text]);
  const sections = useMemo(() => groupAssignedLines(lines, assignment), [lines, assignment]);

  const periods = useMemo(() => parsePeriods(experienceText(sections)), [sections]);

  const gaps = useMemo(() => findGaps(periods), [periods]);
  const timeline = useMemo(() => buildTimeline(periods, gaps), [periods, gaps]);

  const dossier = useMemo(
    () =>
      buildDossier({
        context,
        sections,
        pii: findings,
        periods,
        gaps,
        shortTenures: shortTenures(periods),
        jobs,
      }),
    [context, sections, findings, periods, gaps, jobs],
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
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Análise de carreira</h1>
        <p className="text-sm text-zinc-500">
          Tudo roda no seu navegador. Nenhum arquivo é enviado para lugar nenhum.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <label className="flex flex-col gap-2 text-sm">
          Currículo em PDF
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="file:mr-3 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white dark:file:bg-zinc-100 dark:file:text-black"
          />
        </label>

        {status.step === 'lendo' && (
          <p className="text-sm" role="status">
            Lendo página {status.done} de {status.total}…
          </p>
        )}
        {status.step === 'erro' && (
          <p className="text-sm text-red-600">Não deu para ler o PDF: {status.message}</p>
        )}

        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-500">
            Ou cole o texto do seu perfil do LinkedIn
          </summary>
          <textarea
            onChange={(e) => load(e.target.value)}
            spellCheck={false}
            placeholder="Cole aqui se preferir não subir o PDF."
            className="mt-2 min-h-40 w-full rounded border border-zinc-300 p-3 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        </details>
      </section>

      {status.step === 'pronto' && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Dados pessoais</h2>
            <PiiPanel findings={findings} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Linha do tempo</h2>
            <Timeline data={timeline} />
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold">Seções</h2>
            <SectionEditor
              lines={lines}
              assignment={assignment}
              selection={selection}
              onSelect={onSelect}
              onAssign={onAssign}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Contexto</h2>
            <ContextForm
              context={context}
              jobs={jobs}
              onContext={setContext}
              onJobs={setJobs}
            />
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Dossiê</h2>
            <p className="text-sm text-zinc-500">
              Prompt de análise + seu documento + os achados calculados aqui.
              Cole em qualquer chat de IA.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={copy}
                className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-black"
              >
                {copied ? 'Copiado' : 'Copiar dossiê'}
              </button>
              <button
                type="button"
                onClick={download}
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Baixar .md
              </button>
              <span className="text-xs text-zinc-500">
                {dossier.length.toLocaleString('pt-BR')} caracteres
              </span>
            </div>

            <details>
              <summary className="cursor-pointer text-sm text-zinc-500">
                Ver o dossiê antes de copiar
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded border border-zinc-300 p-3 font-mono text-xs whitespace-pre-wrap dark:border-zinc-700">
                {dossier}
              </pre>
            </details>
          </section>
        </>
      )}
    </main>
  );
}
