/**
 * Reconstrução de ordem de leitura a partir de itens posicionados.
 *
 * TypeScript puro: não importa `pdfjs-dist`, não toca no DOM. Recebe as
 * posições que o extrator produziu e devolve texto. Ver CLAUDE.md > Convenções.
 *
 * Coordenadas em espaço PDF: origem no canto inferior esquerdo, `y` cresce
 * para cima. Por isso toda ordenação vertical é decrescente.
 */

import { cleanText } from './clean';

export type Item = {
  str: string;
  /** borda esquerda */
  x: number;
  /** linha de base */
  y: number;
  width: number;
  /** altura da fonte, usada como tolerância de agrupamento de linha */
  height: number;
};

export type Page = {
  items: Item[];
  width: number;
  height: number;
};

/** Largura mínima da calha, em fração da largura da página. */
const GUTTER_MIN_RATIO = 0.03;
/** Faixa horizontal onde uma calha pode existir. Margens não contam. */
const GUTTER_SEARCH = [0.2, 0.8] as const;
/** Item mais largo que isto atravessa a página: é cabeçalho, não coluna. */
const FULL_WIDTH_RATIO = 0.6;
/** Cada coluna precisa desta fração dos itens para a divisão ser real. */
const MIN_COLUMN_SHARE = 0.15;

/**
 * Procura uma calha vertical: faixa de x que nenhum item de coluna cruza.
 * Devolve `null` quando a página é de coluna única.
 */
export function findGutter(page: Page): number | null {
  const body = page.items.filter(
    (i) => i.str.trim() !== '' && i.width < page.width * FULL_WIDTH_RATIO,
  );
  if (body.length === 0) return null;

  const bins = Math.max(1, Math.round(page.width));
  const covered = new Uint8Array(bins);
  for (const i of body) {
    const from = Math.max(0, Math.floor(i.x));
    const to = Math.min(bins - 1, Math.ceil(i.x + i.width));
    for (let b = from; b <= to; b++) covered[b] = 1;
  }

  const lo = page.width * GUTTER_SEARCH[0];
  const hi = page.width * GUTTER_SEARCH[1];
  const minWidth = page.width * GUTTER_MIN_RATIO;

  let best: { center: number; width: number } | null = null;
  let runStart = -1;
  for (let b = 0; b <= bins; b++) {
    const empty = b < bins && covered[b] === 0;
    if (empty && runStart === -1) runStart = b;
    if (!empty && runStart !== -1) {
      const width = b - runStart;
      const center = runStart + width / 2;
      if (width >= minWidth && center >= lo && center <= hi) {
        if (!best || width > best.width) best = { center, width };
      }
      runStart = -1;
    }
  }
  if (!best) return null;
  const center = best.center;

  // Uma calha só é real se as duas colunas tiverem conteúdo de verdade.
  const left = body.filter((i) => i.x + i.width <= center).length;
  const right = body.filter((i) => i.x >= center).length;
  const floor = body.length * MIN_COLUMN_SHARE;
  return left >= floor && right >= floor ? center : null;
}

/** Agrupa itens em linhas por proximidade de linha de base e junta o texto. */
export function toLines(items: Item[]): string[] {
  // Itens só de espaço são mantidos: em fonte grande, a distância entre dois
  // itens é menor que o limiar de gap e o espaço viria só deles.
  const kept = items.filter((i) => i.str !== '');
  if (kept.length === 0) return [];

  const sorted = [...kept].sort((a, b) => b.y - a.y || a.x - b.x);
  const heights = sorted.map((i) => i.height).filter((h) => h > 0).sort((a, b) => a - b);
  const medianHeight = heights.length > 0 ? heights[Math.floor(heights.length / 2)] : 10;
  const tolerance = medianHeight * 0.5;

  const rows: Item[][] = [];
  for (const item of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(row[0].y - item.y) <= tolerance) row.push(item);
    else rows.push([item]);
  }

  return rows
    .map((row) => {
      const inOrder = [...row].sort((a, b) => a.x - b.x);
      let text = '';
      let cursor: number | null = null;
      for (const item of inOrder) {
        const needsSpace =
          cursor !== null && item.x - cursor > item.height * 0.2 && !/\s$/.test(text);
        text += (needsSpace ? ' ' : '') + item.str;
        cursor = item.x + item.width;
      }
      return text.replace(/\s+/g, ' ').trim();
    })
    .filter((line) => line !== '');
}

/**
 * Texto da página em ordem de leitura.
 *
 * Em página de duas colunas, itens que atravessam a calha (cabeçalho, faixa
 * de separação) cortam a página em blocos horizontais. Dentro de cada bloco,
 * lê-se a coluna esquerda inteira e depois a direita — que é como o documento
 * foi feito para ser lido, e não como o `pdfjs` entrega.
 */
export function pageToText(page: Page): string {
  const gutter = findGutter(page);
  if (gutter === null) return toLines(page.items).join('\n');

  const crosses = (i: Item) => i.x < gutter && i.x + i.width > gutter;
  const banners = page.items.filter((i) => i.str.trim() !== '' && crosses(i));
  const columnItems = page.items.filter((i) => !crosses(i));

  // Cada faixa de cabeçalho vira uma fronteira em y, de cima para baixo.
  const boundaries = [...new Set(banners.map((i) => i.y))].sort((a, b) => b - a);
  // Item na mesma linha de base de um cabeçalho pertence ao bloco acima dele,
  // nunca ao de baixo. Sem isso a linha some do output.
  const tolerance = 1;
  const bandOf = (i: Item) => boundaries.filter((b) => b > i.y + tolerance).length;

  const out: string[] = [];
  for (let band = 0; band <= boundaries.length; band++) {
    const inBand = columnItems.filter((i) => bandOf(i) === band);
    const left = inBand.filter((i) => i.x + i.width <= gutter);
    const right = inBand.filter((i) => i.x > gutter);
    out.push(...toLines(left), ...toLines(right));
    if (band < boundaries.length) {
      out.push(...toLines(banners.filter((i) => i.y === boundaries[band])));
    }
  }

  return out.filter((l) => l !== '').join('\n');
}

/** A última linha da página fecha uma frase. */
const CLOSED = /[.;:!?]\s*$/;
/** A primeira linha da página seguinte continua a frase anterior. */
const CONTINUES = /^[a-zà-ÿ(]/;

/**
 * Documento inteiro. Páginas separadas por linha em branco — menos quando a
 * frase atravessa a quebra.
 *
 * O `pdfjs` não sabe que uma frase continua na página seguinte, e a linha em
 * branco entre páginas é fronteira de parágrafo para tudo a jusante. Uma
 * responsabilidade cortada ao meio virava dois trechos, o primeiro terminando
 * no ar. Quando a página fecha sem pontuação e a próxima abre em minúscula, os
 * dois pedaços são a mesma frase: junta com quebra simples.
 *
 * A limpeza de `clean.ts` roda aqui, antes da junção, porque é aqui que a
 * fronteira de página ainda existe: o rodapé precisa sair antes, senão fica
 * entre os dois pedaços e a costura não acontece.
 */
export function documentToText(pages: Page[]): string {
  const texts = pages
    .map((page) => cleanText(pageToText(page)).trim())
    .filter((t) => t !== '');

  return texts.reduce((acc, page, i) => {
    if (i === 0) return page;
    const stitch = !CLOSED.test(acc) && CONTINUES.test(page);
    return `${acc}${stitch ? '\n' : '\n\n'}${page}`;
  }, '');
}
