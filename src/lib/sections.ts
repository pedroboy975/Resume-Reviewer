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
 * O documento inteiro, em seções, na ordem em que aparecem.
 *
 * O que vem antes do primeiro título é o cabeçalho — nome, título e contato
 * moram lá em praticamente todo currículo.
 */
export function splitSections(text: string): Section[] {
  const lines = text.split('\n');

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
    const body = lines.slice(from, to).join('\n').trim();
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

  let current: SectionKind = 'header';
  lines.forEach((line, i) => {
    const kind = detectHeading(line);
    if (kind) current = kind;
    assignment[i] = current;
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
