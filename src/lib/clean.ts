/**
 * Limpeza do texto extraído, antes de qualquer fatiamento.
 *
 * O `pdfjs` entrega o que está na página, não o que é conteúdo. Rodapé de
 * paginação, linha de localidade do LinkedIn e sentença sem espaço depois do
 * ponto chegam misturados ao texto do vínculo — e a partir daí tudo a jusante
 * herda a corrupção: `paragraphs` costura o rodapé dentro da citação,
 * `scope.ts` cita a frase mutilada, e o dossiê entrega ao modelo um trecho
 * que não existe no documento da pessoa.
 *
 * Roda antes de `redact` e antes de `assignLines`, nos dois caminhos de
 * entrada (PDF e texto colado). É idempotente de propósito: o caminho do PDF
 * passa por aqui duas vezes — uma dentro de `documentToText`, onde a fronteira
 * de página ainda é conhecida, outra na entrada da página.
 *
 * Nada aqui reescreve conteúdo. Remove o que a página impôs e devolve o
 * espaço que o extrator comeu. Ver CLAUDE.md > Split determinístico.
 */

/**
 * Rodapé de paginação. Só a forma explícita: `2/5` sozinho numa linha também
 * é paginação em alguns modelos, mas é fração, data parcial e placar em
 * outros — descartar linha por engano é pior que manter o rodapé.
 */
const PAGE_FURNITURE = /^(?:page|p[áa]g(?:ina)?)\s*\d+\s*(?:of|de)\s*\d+$/i;

export const isPageFurniture = (line: string) => PAGE_FURNITURE.test(line.trim());

/**
 * Ponto final que o extrator colou na palavra seguinte: `hoje.Gerencio`,
 * `(CX).Destaques`. Sem o espaço, a frase inteira vira um token só para o
 * separador de sentenças, e a citação sai com duas frases grudadas.
 *
 * A lookbehind protege inicial de nome (`J.Silva`) e sigla pontuada
 * (`S.A.Bank`): letra maiúscula sozinha antes do ponto não é fim de frase.
 */
const GLUED_SENTENCE = /(?<!\b[A-ZÀ-Ý])([.;])(?=[A-ZÀ-Ý])/g;

/**
 * Linha de localidade do LinkedIn colada na primeira responsabilidade:
 * `"Belo Horizonte, Minas Gerais, Brasil Responsável pela gestão de caixa"`.
 *
 * Localidade é metadado do vínculo, não resultado. Concatenada, ela entra na
 * citação e ainda desloca o começo do trecho — quem lê o dossiê vê a evidência
 * de escopo começando por um nome de cidade.
 *
 * Exatamente três segmentos, que é o formato do export do LinkedIn
 * (cidade, estado, país). Dois segmentos custam caro demais: `"Atendimento,
 * prospecção e retenção Foram os pilares"` tem a mesma forma e quebrar um
 * parágrafo no meio é pior que deixar uma localidade colada. `"Belo
 * Horizonte, MG"` escapa por isso — some quando aparecer num documento real.
 */
const LOCATION_GLUE =
  /^((?![\d])[^,\n\d]{2,28}(?:,\s[^,\n\d]{2,28}){2})\s+(?=[A-ZÀ-Ý][a-zà-ÿ]{2}[^\n]{26,})/;

const SEGMENT_MAX_WORDS = 4;
const LOCATION_MAX_LEN = 60;

/**
 * Tem cara de localidade, não de frase: dois ou três segmentos separados por
 * vírgula, curtos, sem dígito, e cada um começando em maiúscula.
 *
 * A maiúscula por segmento é o que separa `"Contagem, Minas Gerais"` de
 * `"Atendimento, prospecção e retenção"`. Nome de lugar é próprio; item de
 * lista não é.
 *
 * `\p{Lu}` e não `[A-Z]`: o campo de local do LinkedIn sai no idioma do
 * perfil, e um deles chegou em cirílico (`"Белу-Оризонти, MG"`). Continua
 * sendo localidade — e continua não sendo responsabilidade.
 */
export function isLocation(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length > LOCATION_MAX_LEN || /[\d.;:]/.test(trimmed)) return false;

  const parts = trimmed.split(',').map((p) => p.trim());
  if (parts.length < 2 || parts.length > 3) return false;

  return parts.every(
    (part) =>
      part.length >= 2 &&
      part.length <= 28 &&
      /^\p{Lu}/u.test(part) &&
      part.split(/\s+/).length <= SEGMENT_MAX_WORDS,
  );
}

/** Uma linha vira duas quando a localidade está colada no texto do vínculo. */
function ungueLocation(line: string): string {
  const match = LOCATION_GLUE.exec(line);
  if (!match || !isLocation(match[1])) return line;
  return `${match[1]}\n${line.slice(match[0].length)}`;
}

/** Texto extraído, sem o que a página impôs. */
export function cleanText(text: string): string {
  return text
    .split('\n')
    .filter((line) => !isPageFurniture(line))
    .map((line) => ungueLocation(line.replace(GLUED_SENTENCE, '$1 ')))
    .join('\n');
}
