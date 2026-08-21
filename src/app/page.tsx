'use client';

import { useState } from 'react';
import { readPdfText } from '@/lib/pdf-client';

type State = { status: 'idle' | 'lendo' } | { status: 'erro'; message: string };

export default function Home() {
  const [text, setText] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  async function onFile(file: File | undefined) {
    if (!file) return;
    setState({ status: 'lendo' });
    try {
      setText(await readPdfText(file));
      setState({ status: 'idle' });
    } catch (e) {
      setState({ status: 'erro', message: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Extração</h1>
        <p className="text-sm text-zinc-500">
          Tudo roda no seu navegador. Nenhum arquivo é enviado para lugar nenhum.
        </p>
      </header>

      <label className="flex flex-col gap-2 text-sm">
        Currículo em PDF
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="file:mr-3 file:rounded file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-white dark:file:bg-zinc-100 dark:file:text-black"
        />
      </label>

      {state.status === 'lendo' && <p className="text-sm">Lendo…</p>}
      {state.status === 'erro' && (
        <p className="text-sm text-red-600">Não deu para ler o PDF: {state.message}</p>
      )}

      <label className="flex flex-1 flex-col gap-2 text-sm">
        Texto extraído — ou cole aqui o seu perfil do LinkedIn
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          placeholder="Cole o texto aqui se preferir não subir o PDF."
          className="min-h-96 flex-1 rounded border border-zinc-300 p-3 font-mono text-xs leading-relaxed dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>

      <p className="text-xs text-zinc-500">
        {text.length.toLocaleString('pt-BR')} caracteres
      </p>
    </main>
  );
}
