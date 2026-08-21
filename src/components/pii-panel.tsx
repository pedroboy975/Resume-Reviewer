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
      <p className="text-sm text-ink-dim">
        Nenhum dado pessoal detectado no documento.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Elemento-assinatura: cada linha imita uma tarja de redação de
          documento — o retângulo preto cobre o dado, o rótulo em âmbar é a
          única coisa que sobra legível. */}
      <ul className="flex flex-col gap-1.5">
        {counts.map(([kind, count]) => (
          <li key={kind} className="flex items-center gap-3">
            <span aria-hidden className="h-4 w-14 shrink-0 rounded-[1px] bg-redaction" />
            <span className="font-mono text-xs tracking-wide text-amber">
              {LABEL[kind]}
              {count > 1 && <span className="text-ink-dim"> ×{count}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink-dim">
        Já foi tirado do texto. O valor não aparece em nenhuma tela nem em
        nenhum export — só o tipo, uma vez, aqui.
      </p>
    </div>
  );
}
