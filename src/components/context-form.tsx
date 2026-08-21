'use client';

import { LEVELS, type CareerContext, type Level } from '@/lib/dossier';

const MAX_JOBS = 5;

type Props = {
  context: CareerContext;
  jobs: string[];
  onContext: (context: CareerContext) => void;
  onJobs: (jobs: string[]) => void;
};

const inputClass =
  'rounded border border-zinc-300 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-950';

/**
 * O contexto que a Fase 3 do prompt perguntaria.
 *
 * Preenchido aqui, o modelo não precisa parar para perguntar — começa a
 * análise já enquadrada no cargo, no nível, no setor e no país certos.
 */
export function ContextForm({ context, jobs, onContext, onJobs }: Props) {
  const set = <K extends keyof CareerContext>(key: K, value: CareerContext[K]) =>
    onContext({ ...context, [key]: value });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Cargo-alvo
          <input
            className={inputClass}
            value={context.targetRole}
            onChange={(e) => set('targetRole', e.target.value)}
            placeholder="Gerente de Relacionamento, Analista de Dados…"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Nível-alvo
          <select
            className={inputClass}
            value={context.targetLevel}
            onChange={(e) => set('targetLevel', e.target.value as Level | '')}
          >
            <option value="">Não sei</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          Setor ou tipo de empregador
          <input
            className={inputClass}
            value={context.industry}
            onChange={(e) => set('industry', e.target.value)}
            placeholder="Banco de varejo, hospital, prefeitura, startup…"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          País ou mercado
          <input
            className={inputClass}
            value={context.country}
            onChange={(e) => set('country', e.target.value)}
            placeholder="Brasil, Portugal, Estados Unidos…"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Restrições de divulgação
        <input
          className={inputClass}
          value={context.disclosure}
          onChange={(e) => set('disclosure', e.target.value)}
          placeholder="Algum número que a empresa não deixa publicar?"
        />
      </label>

      {context.targetRole.trim() === '' && (
        <p className="rounded border border-amber-400/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Sem cargo-alvo, a análise sai genérica — que costuma ser justamente o
          problema que se quer resolver. Se você ainda não sabe qual é, tudo bem
          seguir: o dossiê pede que o modelo derive de 2 a 3 direções plausíveis
          do seu histórico antes de reescrever qualquer coisa.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Vagas-alvo</h3>
          <span className="text-xs text-zinc-500">
            de 2 a 5, com o texto colado — link de vaga o modelo não abre
          </span>
        </div>

        {jobs.map((job, i) => (
          <textarea
            key={i}
            value={job}
            onChange={(e) => onJobs(jobs.map((j, k) => (k === i ? e.target.value : j)))}
            placeholder={`Vaga ${i + 1}: cole aqui a descrição inteira`}
            className="min-h-24 rounded border border-zinc-300 p-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-950"
          />
        ))}

        <div className="flex gap-2">
          <button
            type="button"
            disabled={jobs.length >= MAX_JOBS}
            onClick={() => onJobs([...jobs, ''])}
            className="rounded border border-zinc-300 px-2 py-1 text-xs enabled:hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:enabled:hover:bg-zinc-900"
          >
            Mais uma vaga
          </button>
          {jobs.length > 1 && (
            <button
              type="button"
              onClick={() => onJobs(jobs.slice(0, -1))}
              className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Menos uma
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
