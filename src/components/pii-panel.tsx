'use client';

import type { PiiFinding, PiiKind } from '@/lib/pii';
import { summarizePii } from '@/lib/pii';

const LABEL: Record<PiiKind, string> = {
  email: 'E-mail',
  telefone: 'Telefone',
  cpf: 'CPF',
  rg: 'Documento de identidade',
  cep: 'CEP',
  endereco: 'Endereço',
  nascimento: 'Data de nascimento',
  idade: 'Idade',
  'estado-civil': 'Estado civil',
  sexo: 'Sexo',
};

/**
 * O que foi redigido, por tipo e quantidade.
 *
 * O valor encontrado nunca aparece aqui. A regra do CLAUDE.md é que o dado
 * pessoal é sinalizado uma vez e não reaparece em nenhum output — o painel é
 * essa única sinalização.
 */
export function PiiPanel({ findings }: { findings: PiiFinding[] }) {
  const counts = Object.entries(summarizePii(findings)) as [PiiKind, number][];

  if (counts.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Nenhum dado pessoal detectado no documento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-2">
        {counts.map(([kind, count]) => (
          <li
            key={kind}
            className="rounded-full border border-amber-400/60 bg-amber-50 px-3 py-1 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            {LABEL[kind]}
            {count > 1 && <span className="opacity-60"> ×{count}</span>}
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">
        Já foi tirado do texto. O valor não aparece em nenhuma tela nem em
        nenhum export — só o tipo, uma vez, aqui.
      </p>
    </div>
  );
}
