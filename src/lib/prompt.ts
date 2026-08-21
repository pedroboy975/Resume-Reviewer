/**
 * O prompt de análise de carreira, lido do documento de origem.
 *
 * `docs/prompt_agente_analise_carreira.md` é a fonte única da lógica de
 * domínio. O CLAUDE.md proíbe reescrever ou resumir esse prompt em outro
 * arquivo — então ele é importado cru e usado inteiro, nunca copiado.
 */

import raw from '../../docs/prompt_agente_analise_carreira.md?raw';

/**
 * O prompt mora dentro de uma cerca de código no markdown, para poder ser
 * copiado inteiro sem o título e as notas em volta.
 */
export function extractFenced(markdown: string): string {
  const first = markdown.indexOf('```');
  const last = markdown.lastIndexOf('```');
  if (first === -1 || last === first) return markdown.trim();
  return markdown.slice(markdown.indexOf('\n', first) + 1, last).trim();
}

export const CAREER_PROMPT = extractFenced(raw);
