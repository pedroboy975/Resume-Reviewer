/**
 * Fatiamento do documento em seções.
 *
 * Heurística de heading por palavra-chave e formato da linha, sobre texto
 * puro. O ROADMAP previa usar também o corpo da fonte, mas a entrada por
 * textarea (LinkedIn colado) não tem informação de fonte nenhuma — e essa
 * entrada precisa funcionar igual. O que sobra é o que vale nos dois casos.
 *
 * O parser vai errar em algum currículo. Por isso cada seção carrega os
 * índices no texto original: a UI do Sprint 3 deixa o usuário reatribuir.
 */

import { parsePeriods } from './dates';

export type SectionKind =
  | 'header'
  | 'contato'
  | 'resumo'
  | 'experiencia'
  | 'formacao'
  | 'competencias'
  | 'idiomas'
  | 'certificacoes'
  | 'outros';

export type Section = {
  kind: SectionKind;
  /** Linha de título que abriu a seção. `null` no cabeçalho. */
  heading: string | null;
  /** Conteúdo da seção, sem a linha de título. */
  text: string;
  /** Recorte no texto original, incluindo a linha de título. */
  start: number;
  end: number;
};

/** Sem acento, sem pontuação de borda, minúsculo. */
const normalize = (line: string) =>
  line
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[|·•—–-]/g, ' ')
    .replace(/[:.]+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Primeira palavra-chave da linha decide a seção. Ordem da lista é ordem de
 * desempate: "FORMAÇÃO ACADÊMICA | IDIOMAS" é formação, não idiomas.
 */
const HEADINGS: [SectionKind, RegExp][] = [
  ['experiencia', /^(experiencias?|experiencia profissional|historico profissional|atuacao profissional|trajetoria|experience|work experience|employment)\b/],
  ['formacao', /^(formacao|escolaridade|educacao|education|graduacao|academic)\b/],
  ['competencias', /^(competencias|principais competencias|habilidades|conhecimentos|qualificacoes|skills|top skills|tecnologias)\b/],
  ['idiomas', /^(idiomas?|linguas?|languages?)\b/],
  ['certificacoes', /^(certificacoes|certificados?|certifications?|licenses|cursos|treinamentos|premios)\b/],
  ['resumo', /^(resumo|sintese|sintese profissional|sumario|perfil|perfil profissional|objetivos?|about|summary|sobre mim)\b/],
  ['contato', /^(contatos?|contact|dados pessoais|informacoes pessoais|informacoes de contato)\b/],
];

/** Título de seção é linha curta, sem cara de frase. Devolve `null` se não for. */
export function detectHeading(line: string): SectionKind | null {
  const trimmed = line.trim();
  if (trimmed === '' || trimmed.length > 60) return null;
  // Frase inteira não é título, por mais que comece com a palavra certa:
  // "Experiência em otimizar resultados a partir de..." é texto corrido.
  if (trimmed.split(/\s+/).length > 6) return null;
  // Título não termina em ponto nem em vírgula: "cursos disponíveis." é o fim
  // de um parágrafo, não a abertura de uma seção.
  if (/[,;.]$/.test(trimmed)) return null;

  const normalized = normalize(trimmed);
  for (const [kind, pattern] of HEADINGS) {
    if (pattern.test(normalized)) return kind;
  }
  return null;
}

/**
 * Headline do LinkedIn: termos separados por barra vertical.
 *
 * Duas barras, não uma: uma barra sozinha aparece em endereço, em tabela e em
 * "Analista | Pleno". Duas é lista de especialidades, que é o que a headline é.
 */
const HEADLINE_MARK = '|';
const isHeadline = (line: string) => line.split(HEADLINE_MARK).length > 2;
/** Linhas de metadado que podem vir depois da headline: localidade e afins. */
const IDENTITY_TAIL = 2;

/**
 * A linha tem cara de nome de pessoa.
 *
 * É a condição que separa a headline de um perfil de uma lista de termos com
 * a mesma forma. Um currículo trazia `"Áreas de Interesse:"` seguido de
 * `"GESTÃO | SUPRIMENTOS | PROCESSOS | INFRAESTRUTURA"` — estrutura idêntica à
 * de uma headline, e sem esta checagem as duas linhas eram descartadas como
 * dado pessoal. Nome não termina em dois-pontos, não tem dígito e é curto.
 */
function looksLikeName(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2 || trimmed.length > 60) return false;
  if (/[:;.\d|]/.test(trimmed)) return false;
  return trimmed.split(/\s+/).length <= 6 && detectHeading(trimmed) === null;
}

/**
 * O bloco de identidade do export do LinkedIn: nome, headline e localidade.
 *
 * No PDF ele mora na coluna lateral, e a leitura por coluna o entrega depois
 * do último item daquela coluna — que costuma ser a lista de certificados.
 * Sem heading próprio, ele é absorvido pela última seção aberta, qualquer que
 * ela seja. Já causou dois danos medidos: o diagnóstico afirmou que a seção
 * de Certificações "contém apenas cursos livres" sem perceber que ela estava
 * contaminada, e criticou a headline como se fosse texto de Resumo — barra
 * vertical é a convenção correta de headline, e virou "poluição visual".
 *
 * As linhas viram `contato`, que é a seção que não sai do app de jeito nenhum.
 * O nome completo estava indo para dentro do bloco `## Documento` do dossiê,
 * que promete texto "já com os dados pessoais removidos". Ver CLAUDE.md > PII.
 *
 * A âncora é a headline, não a localidade: a headline tem forma reconhecível
 * em qualquer perfil, e a localidade varia demais — "Belo Horizonte, Minas
 * Gerais, Brasil" num export, "Belo Horizonte e Região" no outro. Da headline
 * sobe-se uma linha (o nome) e desce-se o rabo de metadado.
 */
function identityLines(lines: string[]): Set<number> {
  const marked = new Set<number>();
  const stops = (line: string) =>
    line === '' || detectHeading(line) !== null || parsePeriods(line).length > 0;

  lines.forEach((line, i) => {
    if (!isHeadline(line)) return;

    let top = i;
    let bottom = i;

    // A headline pode quebrar em várias linhas; a de cima dela é o nome. Sem
    // nome acima não é bloco de identidade — é uma lista com barras.
    while (top > 0 && isHeadline(lines[top - 1])) top--;
    if (top === 0 || !looksLikeName(lines[top - 1])) return;
    top--;

    while (bottom + 1 < lines.length && isHeadline(lines[bottom + 1])) bottom++;
    for (let k = 0; k < IDENTITY_TAIL; k++) {
      const next = lines[bottom + 1];
      if (next === undefined || stops(next.trim()) || next.trim().length > 60) break;
      bottom++;
    }

    for (let j = top; j <= bottom; j++) marked.add(j);
  });

  return marked;
}

/**
 * O documento inteiro, em seções, na ordem em que aparecem.
 *
 * O que vem antes do primeiro título é o cabeçalho — nome, título e contato
 * moram lá em praticamente todo currículo.
 */
export function splitSections(text: string): Section[] {
  const lines = text.split('\n');
  const identity = identityLines(lines);

  // Posição inicial de cada linha no texto original.
  const offsets: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    offsets.push(cursor);
    cursor += line.length + 1;
  }

  const marks: { kind: SectionKind; line: number }[] = [];
  lines.forEach((line, i) => {
    const kind = detectHeading(line);
    if (kind) marks.push({ kind, line: i });
  });

  const sections: Section[] = [];
  const push = (kind: SectionKind, headingLine: number | null, from: number, to: number) => {
    const start = headingLine === null ? 0 : offsets[headingLine];
    const end = to < lines.length ? offsets[to] : text.length;
    const body = lines
      .slice(from, to)
      .filter((_, i) => !identity.has(from + i))
      .join('\n')
      .trim();
    if (headingLine === null && body === '') return;
    sections.push({
      kind,
      heading: headingLine === null ? null : lines[headingLine].trim(),
      text: body,
      start,
      end,
    });
  };

  const first = marks[0]?.line ?? lines.length;
  push('header', null, 0, first);

  marks.forEach((mark, i) => {
    const next = marks[i + 1]?.line ?? lines.length;
    push(mark.kind, mark.line, mark.line + 1, next);
  });

  return sections;
}

/**
 * Todo o texto de uma seção, juntando repetições.
 *
 * Currículo de duas colunas costuma repetir o mesmo título em várias páginas,
 * e o LinkedIn parte "Experiência" a cada quebra de página.
 */
export function sectionText(sections: Section[], kind: SectionKind): string {
  return sections
    .filter((s) => s.kind === kind)
    .map((s) => s.text)
    .filter((t) => t !== '')
    .join('\n');
}

/**
 * A qual seção pertence cada linha do texto.
 *
 * É a forma que a UI de correção precisa: o usuário seleciona linhas e troca
 * a seção delas. Reatribuir vira uma edição neste vetor, e as seções são
 * recalculadas a partir dele.
 */
export function assignLines(text: string): SectionKind[] {
  const lines = text.split('\n');
  const assignment: SectionKind[] = new Array(lines.length).fill('header');
  const identity = identityLines(lines);

  let current: SectionKind = 'header';
  lines.forEach((line, i) => {
    const kind = detectHeading(line);
    if (kind) current = kind;
    // O bloco de identidade não abre nem fecha seção: só sai de onde caiu.
    assignment[i] = identity.has(i) ? 'contato' : current;
  });

  return assignment;
}

export type AssignedSection = {
  kind: SectionKind;
  /** Índices de linha, inclusivos. */
  from: number;
  to: number;
  text: string;
};

/** Linhas consecutivas com a mesma seção viram um bloco. */
export function groupAssignedLines(lines: string[], assignment: SectionKind[]): AssignedSection[] {
  const groups: AssignedSection[] = [];
  lines.forEach((line, i) => {
    const last = groups[groups.length - 1];
    if (last && last.kind === assignment[i]) {
      last.to = i;
      last.text += `\n${line}`;
    } else {
      groups.push({ kind: assignment[i], from: i, to: i, text: line });
    }
  });
  return groups;
}

/**
 * Ordem canônica das seções no dossiê. Currículo não sai na ordem do PDF.
 *
 * `contato` não está aqui de propósito: é a seção onde mora o dado pessoal, e
 * redigir não basta — o que os regexes de `pii.ts` não pegam (handle, cidade,
 * perfil) sairia junto. A seção inteira fica fora do que deixa o app.
 * Ver CLAUDE.md > PII.
 */
export const SECTION_ORDER: SectionKind[] = [
  'header',
  'resumo',
  'experiencia',
  'formacao',
  'competencias',
  'certificacoes',
  'idiomas',
  'outros',
];

/** Nome de cada seção em português. Vale para a UI e para o dossiê. */
export const SECTION_LABEL: Record<SectionKind, string> = {
  header: 'Cabeçalho',
  contato: 'Contato',
  resumo: 'Resumo',
  experiencia: 'Experiência',
  formacao: 'Formação',
  competencias: 'Competências',
  idiomas: 'Idiomas',
  certificacoes: 'Certificações',
  outros: 'Outros',
};

/**
 * Todo o texto atribuído a Experiência.
 *
 * Existe porque três lugares precisavam do mesmo encadeamento — a página, o
 * dossiê e os testes — e datas de formação ou de certificado entrando aqui
 * abrem lacuna de emprego que não existe.
 */
export const experienceText = (sections: AssignedSection[]): string =>
  sections
    .filter((s) => s.kind === 'experiencia')
    .map((s) => s.text)
    .join('\n');
