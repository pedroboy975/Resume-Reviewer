/**
 * O mesmo trecho de resultado escrito em duas seções.
 *
 * A Fase 4 do prompt proíbe repetir a mesma âncora de escala em lugares
 * diferentes; a Fase 2 não tem o espelho dessa regra, e num dos casos reais o
 * modelo elogiou a métrica como ponto forte sem notar a duplicação. Duas
 * aparições da mesma conquista viram duas conquistas para quem lê rápido, e é
 * justamente esse o efeito.
 *
 * Comparar frase inteira não bastava. No caso real o Resumo traz
 * `"Destaques de Performance: Portabilidade de Investimentos: Viabilizei a
 * captação de R$ 2,3 milhões..."` e a Experiência traz a mesma coisa com
 * `"& Foco Estratégico"` no meio e uma oração a mais no fim — nenhuma das
 * duas frases é igual à outra, e o pedaço copiado tem 150 caracteres.
 *
 * Então a comparação é por sequência de palavras: `K` palavras seguidas que
 * aparecem em duas seções marcam o trecho, e os trechos vizinhos são
 * costurados de volta no maior pedaço comum. Ainda é match literal — o app diz
 * "este texto está nos dois lugares", nunca "estas duas redações são a mesma
 * ideia", que é julgamento de prosa. Ver CLAUDE.md > Split determinístico.
 */

import { stripAccents } from './companies';
import { SECTION_LABEL, type AssignedSection, type SectionKind } from './sections';

export type RepeatedLine = {
  /** Trecho verbatim, na forma em que aparece na primeira seção. */
  quote: string;
  /** Seções em que ele aparece, na ordem em que a primeira o traz. */
  sections: SectionKind[];
};

/**
 * Palavras seguidas que já não são coincidência.
 *
 * Oito palavras dão uns sessenta caracteres, que é onde a repetição deixa de
 * ser vocabulário compartilhado — "gestão de relacionamento com clientes de
 * alta renda" cabe em duas seções sem ninguém ter copiado nada.
 */
const K = 8;

/** Abaixo disto o trecho costurado ainda é curto demais para ser âncora. */
const MIN_LEN = 60;

const WORD = /[\p{L}\p{N}][\p{L}\p{N}.,]*/gu;

type Token = { key: string; start: number; end: number };

const tokenize = (text: string): Token[] =>
  [...text.matchAll(WORD)].map((m) => ({
    key: stripAccents(m[0]).toLowerCase(),
    start: m.index,
    end: m.index + m[0].length,
  }));

/** Nomes das seções, do jeito que o dossiê já escreve. */
export const sectionNames = (kinds: SectionKind[]) => kinds.map((k) => SECTION_LABEL[k]).join(' e ');

/** Trechos longos que aparecem literalmente em mais de uma seção. */
export function findRepeatedLines(sections: AssignedSection[]): RepeatedLine[] {
  // Repetição dentro da mesma seção não é o achado: o export do LinkedIn
  // fatia "Experiência" a cada quebra de página, e seriam vários blocos da
  // mesma seção comparados entre si.
  const byKind = new Map<SectionKind, string>();
  for (const s of sections) {
    byKind.set(s.kind, `${byKind.get(s.kind) ?? ''}\n${s.text}`);
  }

  const kinds = [...byKind.keys()];
  const texts = kinds.map((k) => byKind.get(k) ?? '');
  const tokens = texts.map(tokenize);

  // Sequência de K palavras → seções em que ela aparece.
  const shingles = new Map<string, Set<number>>();
  tokens.forEach((toks, si) => {
    for (let i = 0; i + K <= toks.length; i++) {
      const key = toks
        .slice(i, i + K)
        .map((t) => t.key)
        .join(' ');
      const seen = shingles.get(key) ?? new Set<number>();
      seen.add(si);
      shingles.set(key, seen);
    }
  });

  const out: RepeatedLine[] = [];
  const reported = new Set<string>();

  tokens.forEach((toks, si) => {
    let runStart = -1;
    let runWith = new Set<number>();

    const flush = (last: number) => {
      if (runStart < 0) return;
      const others = [...runWith].filter((o) => o !== si);
      // O par sai uma vez só, pela seção que traz o trecho primeiro. As duas
      // cópias raramente são iguais nas bordas — no caso real uma tem uma
      // oração a mais no fim —, então deduplicar pelo texto não funciona.
      if (others.every((o) => o > si)) {
        const quote = texts[si]
          .slice(toks[runStart].start, toks[last + K - 1].end)
          .replace(/\s+/g, ' ')
          .trim();
        if (quote.length >= MIN_LEN && !reported.has(quote)) {
          reported.add(quote);
          out.push({ quote, sections: [kinds[si], ...others.map((o) => kinds[o])] });
        }
      }
      runStart = -1;
      runWith = new Set();
    };

    for (let i = 0; i + K <= toks.length; i++) {
      const key = toks
        .slice(i, i + K)
        .map((t) => t.key)
        .join(' ');
      const seen = shingles.get(key);
      const repeated = seen !== undefined && seen.size > 1;

      if (!repeated) {
        flush(i - 1);
        continue;
      }
      if (runStart < 0) runStart = i;
      for (const o of seen) runWith.add(o);
    }
    flush(toks.length - K);
  });

  return out;
}
