'use client';

import { ARTIFACT_LABEL, type ArtifactKind } from '@/lib/dossier';

const KINDS = Object.keys(ARTIFACT_LABEL) as ArtifactKind[];

/**
 * Como obter o arquivo, por tipo de artefato.
 *
 * O modelo não navega no LinkedIn — nem este app: o LinkedIn exige sessão
 * autenticada, proíbe acesso automatizado nos termos de uso, e o browser
 * bloqueia a requisição por CORS de qualquer forma. O que o LinkedIn
 * entrega de bom grado é o PDF do próprio perfil, e é dele que partimos.
 */
const HOW: Record<ArtifactKind, string> = {
  linkedin:
    'No seu perfil, abra "Mais" logo abaixo da foto e escolha "Salvar como PDF". Suba o arquivo aqui.',
  curriculo: 'Suba o arquivo do seu currículo em PDF.',
  ambos:
    'Suba um de cada vez — o "Salvar como PDF" do seu perfil do LinkedIn e o seu currículo — conferindo as seções entre um e outro.',
};

type Props = {
  value: ArtifactKind;
  onChange: (kind: ArtifactKind) => void;
};

/** O que está sendo analisado. A Fase 1 do prompt classifica isto primeiro. */
export function SourcePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-ink">O que você vai analisar?</span>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={value === kind}
            onClick={() => onChange(kind)}
            className={`rounded border px-3 py-1.5 text-sm transition-colors ${
              value === kind
                ? 'border-amber bg-amber-dim text-amber'
                : 'border-border text-ink-dim hover:border-amber/40 hover:text-ink'
            }`}
          >
            {ARTIFACT_LABEL[kind]}
          </button>
        ))}
      </div>

      <p className="text-xs text-ink-dim">{HOW[value]}</p>
    </div>
  );
}
