/**
 * Validadores do texto que volta do LLM.
 *
 * Aqui começa a metade que faltava do produto. O motor determinístico monta o
 * dossiê e o entrega; o que o modelo escreve de volta nunca passou por
 * verificação nenhuma. A regra 2 do CLAUDE.md diz que zero fabricação é
 * invariante de código e não promessa de prompt — e até agora era promessa de
 * prompt, porque nada lia a saída.
 *
 * Todo validador é a mesma função: `(fonte, saída) → violações`. TypeScript
 * puro, testável sem modelo nenhum, medido contra as rodadas reais guardadas
 * em `tests/fixtures/outputs/`.
 *
 * O que este módulo **não** faz: corrigir. Uma violação é um trecho verbatim
 * da saída com o nome da regra que ele quebra. Quem decide o que fazer é quem
 * está lendo. Ver CLAUDE.md > Julgue o documento.
 */

import { DISTANCES, LEVELS } from './dossier';

export type Violation = {
  /** A regra quebrada, no vocabulário da especificação. */
  rule: string;
  /** O campo onde a violação está, quando ela tem um. */
  field: string;
  /** Trecho verbatim da saída. Vazio quando a violação é a ausência. */
  quote: string;
  detail: string;
};

/**
 * Os três campos da regra 5 do CLAUDE.md, com as duas grafias que aparecem na
 * prática: a canônica, que o dossiê passou a exigir, e a da prosa do prompt,
 * que é a que as cinco rodadas reais usaram.
 */
const FIELDS: { field: string; label: RegExp; allowed: readonly string[] }[] = [
  {
    field: 'Nível comprovado',
    label: /(?:NIVEL_COMPROVADO|N[íi]vel comprovado[^:\n]*)\s*:/i,
    allowed: LEVELS,
  },
  {
    field: 'Nível prometido',
    label: /(?:NIVEL_PROMETIDO|N[íi]vel (?:que o documento|prometido)[^:\n]*)\s*:/i,
    allowed: LEVELS,
  },
  {
    field: 'Distância',
    label: /(?:DISTANCIA|Dist[âa]ncia(?: entre os dois)?)\s*:/i,
    allowed: DISTANCES,
  },
];

/**
 * O valor declarado logo depois do rótulo.
 *
 * A saída real escreve `**Nível comprovado hoje:** **Gestor**. Justificativa
 * em prosa...` — o valor é o primeiro trecho em negrito, e o que vem depois é
 * a justificativa, que é legítima e não entra na comparação. Sem negrito, o
 * valor vai até o primeiro ponto final ou o fim da linha.
 */
function valueAfter(output: string, label: RegExp): string | null {
  const at = label.exec(output);
  if (!at) return null;

  // O rótulo em negrito fecha o próprio negrito depois dos dois-pontos, e o
  // par de asteriscos que sobra é dele, não do valor.
  const rest = output
    .slice(at.index + at[0].length)
    .replace(/^\*{1,2}/, '')
    .replace(/^[ \t]+/, '');
  const bold = /^\*\*(.+?)\*\*/.exec(rest);
  const raw = bold ? bold[1] : (/^[^.\n]*/.exec(rest)?.[0] ?? '');
  return raw.replace(/[*_`]/g, '').trim().replace(/\.$/, '');
}

/** Comparação de valor de enum: caixa e espaço não são divergência. */
const same = (a: string, b: string) =>
  a.toLowerCase().replace(/\s+/g, ' ') === b.toLowerCase().replace(/\s+/g, ' ');

/**
 * D7 — os três campos de nível existem e cada um traz **um** valor do enum.
 *
 * Foi a violação mais frequente das rodadas reais: 5 saídas em 5 quebraram o
 * enum, sempre do mesmo jeito — dois níveis separados por barra, ou um valor
 * inventado com um qualificador entre parênteses. `Especialista / Coordenador
 * Técnico (Pleno a Sênior)` não é um nível; são três, e nenhum deles é
 * acionável. Uma rodada chegou a produzir `Pleno Sênior`, que não existe.
 *
 * Campo ausente também é violação: a segunda rodada da Laura respondeu às
 * perguntas da Fase 3 e devolveu a análise sem o bloco da Fase 1 inteiro.
 */
export function checkLevelFields(output: string): Violation[] {
  return FIELDS.flatMap(({ field, label, allowed }) => {
    const value = valueAfter(output, label);

    if (value === null || value === '') {
      return [
        {
          rule: 'D7 enum de nível',
          field,
          quote: '',
          detail: 'campo ausente na saída',
        },
      ];
    }

    if (allowed.some((ok) => same(ok, value))) return [];

    return [
      {
        rule: 'D7 enum de nível',
        field,
        quote: value,
        detail: `valor fora do enum: ${allowed.join(' | ')}`,
      },
    ];
  });
}
