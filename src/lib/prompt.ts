/**
 * O prompt de análise de carreira, lido do documento de origem.
 *
 * `docs/prompt_agente_analise_carreira.md` é a fonte única da lógica de
 * domínio. O CLAUDE.md proíbe reescrever ou resumir esse prompt em outro
 * arquivo — então ele é importado cru e usado inteiro, nunca copiado.
 */

import raw from '../../docs/prompt_agente_analise_carreira.md?raw';

/**
 * O conteúdo da primeira cerca de código do markdown.
 *
 * O prompt mora dentro de uma cerca para poder ser copiado inteiro sem o
 * título e as notas em volta. A cerca de fechamento é a próxima linha que
 * seja só o marcador — não a última do arquivo. Um segundo bloco de código
 * adicionado ao documento passaria despercebido com `lastIndexOf`, e o
 * prompt sairia com texto que não é dele no meio.
 */
export function extractFenced(markdown: string): string {
  const lines = markdown.split('\n');
  const open = lines.findIndex((line) => line.trimEnd() === '```');
  if (open === -1) return markdown.trim();

  const close = lines.findIndex((line, i) => i > open && line.trimEnd() === '```');
  const body = close === -1 ? lines.slice(open + 1) : lines.slice(open + 1, close);
  return body.join('\n').trim();
}

export const CAREER_PROMPT = extractFenced(raw);
