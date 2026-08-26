/**
 * Períodos, lacunas e permanências curtas.
 *
 * Aritmética de data é trabalho de TypeScript, não de modelo.
 * Ver CLAUDE.md > Split determinístico.
 *
 * Tudo em meses inteiros: currículo não declara dia, e a diferença entre
 * "2 anos 8 meses" e "2 anos 7 meses e 12 dias" não muda decisão nenhuma.
 */

/** Mês de calendário. `month` é 1–12. */
export type YearMonth = { year: number; month: number };

export const formatYearMonth = (ym: YearMonth): string =>
  `${String(ym.month).padStart(2, '0')}/${ym.year}`;

export type Period = {
  start: YearMonth;
  /** `null` = em andamento ("atual", "Present", "em andamento"). */
  end: YearMonth | null;
  /** Trecho verbatim do documento. Ver CLAUDE.md > Citação obrigatória. */
  quote: string;
  /** Posição do trecho no texto de origem. */
  index: number;
  /** `year` = o documento só declarou o ano; o mês foi inferido. */
  precision: 'month' | 'year';
};

export type Gap = {
  from: YearMonth;
  to: YearMonth;
  months: number;
};

const MONTHS_PT = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const MONTHS_EN = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

/** `jan`, `jan.`, `janeiro`, `jan/`, `sept` — tudo cai no mesmo índice. */
const MONTH_INDEX = new Map<string, number>();
for (const list of [MONTHS_PT, MONTHS_EN]) {
  list.forEach((name, i) => {
    MONTH_INDEX.set(name, i + 1);
    MONTH_INDEX.set(name.slice(0, 3), i + 1);
  });
}
MONTH_INDEX.set('set', 9); // setembro; sem isto, "set" fica com o "sep" inglês
MONTH_INDEX.set('sept', 9);

// Alternação explícita, do nome mais longo para o mais curto. Nada de
// `[a-z]{3,4}` genérico: isso casaria o fim de "ArcelorMittal 2012" e
// consumiria o período seguinte na varredura.
const NAMES = [...MONTH_INDEX.keys()].sort((a, b) => b.length - a.length).join('|');
const NOW_WORDS = 'atual|atualmente|presente|present|current|hoje|momento|em andamento';
// O separador em palavra exige espaço dos dois lados. `\b` não serve: "á" não
// é caractere de palavra para o motor de regex, e a fronteira nunca casa.
// `ate` sem acento está aqui porque currículo em caixa alta costuma perder o
// acento: "01/07/2017 ATE 01/03/2019" ficava sem período reconhecido, e com
// ele a descrição do cargo seguinte era engolida pelo parágrafo anterior.
const SEPARATOR = String.raw`(?:\s*[-–—]{1,2}\s*|\s+(?:a|á|à|até|ate|to)\s+)`;
// dd/mm/aaaa, mm/aaaa, "março de 2020", "Março/2020", "mar 2020" ou só o ano.
// As lookarounds impedem que "2010/2011" produza o token "10/2011".
const TOKEN = String.raw`(?<![\d/])(?:\d{1,2}/\d{1,2}/\d{4}|\d{1,2}/\d{4}|(?:${NAMES})\.?\s*(?:de\s*|/\s*)?\d{4}|\d{4})(?![\d/])`;
const PERIOD = new RegExp(String.raw`(${TOKEN})${SEPARATOR}(${TOKEN}|${NOW_WORDS})`, 'gi');

const normalize = (s: string) => s.toLowerCase().normalize('NFC');

/** Um extremo do período. `null` quando o texto não é data reconhecível. */
function parseToken(raw: string): { ym: YearMonth; precision: 'month' | 'year' } | null {
  const token = normalize(raw).trim();

  const slashed = /^(\d{1,2})\/(?:(\d{1,2})\/)?(\d{4})$/.exec(token);
  if (slashed) {
    // Em dd/mm/aaaa o mês é o segundo campo; em mm/aaaa é o primeiro.
    const month = Number(slashed[2] ?? slashed[1]);
    if (month < 1 || month > 12) return null;
    return { ym: { year: Number(slashed[3]), month }, precision: 'month' };
  }

  const named = /^([a-zà-ÿ]{3,10})\.?\s*(?:de\s*|\/\s*)?(\d{4})$/.exec(token);
  if (named) {
    const month = MONTH_INDEX.get(named[1]) ?? MONTH_INDEX.get(named[1].slice(0, 3));
    if (!month) return null;
    return { ym: { year: Number(named[2]), month }, precision: 'month' };
  }

  if (/^\d{4}$/.test(token)) {
    const year = Number(token);
    if (year < 1950 || year > 2100) return null;
    return { ym: { year, month: 1 }, precision: 'year' };
  }

  return null;
}

const isNowWord = (raw: string) => new RegExp(`^(?:${NOW_WORDS})$`, 'i').test(raw.trim());

/** Meses de `a` até `b`. Negativo se `b` vem antes de `a`. */
export function monthsBetween(a: YearMonth, b: YearMonth): number {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

export const toYearMonth = (d: Date): YearMonth => ({
  year: d.getFullYear(),
  month: d.getMonth() + 1,
});

/** Todos os períodos do texto, na ordem em que aparecem. */
export function parsePeriods(text: string): Period[] {
  const out: Period[] = [];
  for (const match of text.matchAll(PERIOD)) {
    const start = parseToken(match[1]);
    if (!start) continue;

    const ongoing = isNowWord(match[2]);
    const end = ongoing ? null : parseToken(match[2]);
    if (!ongoing && !end) continue;

    // Ano solto em um dos lados: o período vira o mais largo possível, para
    // não inventar lacuna onde o documento só foi impreciso.
    const precision = start.precision === 'year' || end?.precision === 'year' ? 'year' : 'month';
    const startYm = start.precision === 'year' ? { year: start.ym.year, month: 1 } : start.ym;
    const endYm =
      end && end.precision === 'year' ? { year: end.ym.year, month: 12 } : (end?.ym ?? null);

    if (endYm && monthsBetween(startYm, endYm) < 0) continue;

    out.push({ start: startYm, end: endYm, quote: match[0], index: match.index, precision });
  }
  return out;
}

/**
 * Duração em meses, contando o primeiro e o último. Período em andamento é
 * medido até `now`.
 *
 * O `+1` é o que separa duração de diferença. Quem trabalhou de fevereiro a
 * maio trabalhou quatro meses, não três — e é isso que o LinkedIn escreve ao
 * lado do período. Sem ele o app contradizia o próprio documento que estava
 * lendo, sempre um mês para menos, em todos os vínculos.
 *
 * `findGaps` continua usando `monthsBetween` cru de propósito: lá o intervalo
 * é o vão entre um emprego e o outro, e contar as pontas transformaria toda
 * troca de emprego em lacuna de um mês.
 */
export function durationMonths(period: Period, now: Date = new Date()): number {
  const end = period.end ?? toYearMonth(now);
  return Math.max(0, monthsBetween(period.start, end) + 1);
}

/**
 * Lacunas entre períodos, ignoradas as sobreposições.
 *
 * `minMonths` existe porque troca de emprego com um mês de intervalo não é
 * lacuna de carreira — é troca de emprego.
 */
export function findGaps(
  periods: Period[],
  { minMonths = 4, now = new Date() }: { minMonths?: number; now?: Date } = {},
): Gap[] {
  const ranges = periods
    .map((p) => ({ start: p.start, end: p.end ?? toYearMonth(now) }))
    .sort((a, b) => monthsBetween(b.start, a.start));

  const gaps: Gap[] = [];
  let covered: YearMonth | null = null;
  for (const range of ranges) {
    if (covered && monthsBetween(covered, range.start) >= minMonths) {
      gaps.push({ from: covered, to: range.start, months: monthsBetween(covered, range.start) });
    }
    if (!covered || monthsBetween(covered, range.end) > 0) covered = range.end;
  }
  return gaps;
}

/** Dois períodos que correm ao mesmo tempo. */
export type Overlap = {
  a: Period;
  b: Period;
  months: number;
};

/**
 * Pares de períodos sobrepostos, na ordem em que começam.
 *
 * É a "ambiguidade de histórico" que a Fase 3 do prompt manda perguntar —
 * cargo paralelo, consultoria durante o emprego, sociedade mantida em
 * segundo plano. O app não decide o que é: só aponta que duas datas dividem
 * os mesmos meses e devolve a pergunta.
 *
 * `minMonths` é 2 porque a sobreposição de um mês é troca de emprego: um
 * vínculo termina em janeiro, o outro começa em janeiro, e ninguém teve dois
 * empregos por isso.
 */
export function findOverlaps(
  periods: Period[],
  { minMonths = 2, now = new Date() }: { minMonths?: number; now?: Date } = {},
): Overlap[] {
  const sorted = chronological(periods);
  const finish = (p: Period) => p.end ?? toYearMonth(now);
  const out: Overlap[] = [];

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const start = sorted[j].start; // já é o mais tardio: a lista está ordenada
      const end = monthsBetween(finish(sorted[i]), finish(sorted[j])) < 0
        ? finish(sorted[j])
        : finish(sorted[i]);
      const months = monthsBetween(start, end) + 1;
      if (months >= minMonths) out.push({ a: sorted[i], b: sorted[j], months });
    }
  }
  return out;
}

/**
 * Mais antigo primeiro.
 *
 * O documento não vem ordenado: o export do LinkedIn lista o emprego atual
 * primeiro, e cargo paralelo aparece onde couber. Emitir a lista na ordem de
 * aparição entrega ao leitor uma linha do tempo que salta para trás no meio.
 */
export const byRecentStart = (a: Period, b: Period): number => monthsBetween(b.start, a.start);

export const chronological = (periods: Period[]): Period[] => [...periods].sort(byRecentStart);

/** Períodos mais curtos que `maxMonths`. Em andamento nunca conta: ainda está correndo. */
export function shortTenures(
  periods: Period[],
  { maxMonths = 12, now = new Date() }: { maxMonths?: number; now?: Date } = {},
): Period[] {
  return periods.filter((p) => p.end !== null && durationMonths(p, now) < maxMonths);
}

/**
 * Meses de experiência somados, sem contar duas vezes o que se sobrepõe.
 *
 * Existe porque vaga costuma exigir "mínimo de N anos", e somar a duração de
 * cada vínculo daria a resposta errada para quem teve cargo paralelo: dois
 * empregos no mesmo semestre não são doze meses de experiência, são seis.
 * Aqui os períodos são unidos antes de somar.
 *
 * O que se conta é o tempo coberto por algum vínculo, não a carreira: lacuna
 * entre um emprego e o outro não entra. Quem quiser a diferença entre as duas
 * coisas tem `findGaps` ao lado.
 */
export function totalMonths(periods: Period[], { now = new Date() }: { now?: Date } = {}): number {
  const ranges = periods
    .map((p) => ({ start: p.start, end: p.end ?? toYearMonth(now) }))
    .sort((a, b) => monthsBetween(b.start, a.start));

  let total = 0;
  let covered: YearMonth | null = null;
  for (const range of ranges) {
    // O começo efetivo é o mais tarde entre o início e o fim do que já foi
    // contado: o mês em que o vínculo anterior terminou já está na soma.
    const from = covered && monthsBetween(covered, range.start) <= 0 ? covered : range.start;
    const months = monthsBetween(from, range.end) + (covered && from === covered ? 0 : 1);
    if (months > 0) total += months;
    if (!covered || monthsBetween(covered, range.end) > 0) covered = range.end;
  }
  return total;
}
