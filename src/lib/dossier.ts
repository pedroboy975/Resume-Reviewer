/**
 * Montagem do dossiê: prompt + contexto + documento + achados + vagas.
 *
 * Tudo aqui é concatenação determinística. O prompt vem inteiro de
 * `prompt.ts`, que o lê do documento de origem — nada é reescrito aqui.
 *
 * Regra que este módulo precisa manter sozinho: o valor de um dado pessoal
 * nunca entra no dossiê. Só o tipo e a quantidade. Ver CLAUDE.md > PII.
 */

import { durationMonths, type Gap, type Period, type YearMonth } from './dates';
import { checkField, countChars, LINKEDIN } from './limits';
import { redact, summarizePii, type PiiFinding } from './pii';
import { CAREER_PROMPT } from './prompt';
import {
  detectHeading,
  SECTION_ORDER,
  type AssignedSection,
  type SectionKind,
} from './sections';

/** Níveis do CLAUDE.md. Vazio = a pessoa não sabe, e isso muda a Fase 1. */
export const LEVELS = ['Júnior', 'Pleno', 'Sênior', 'Especialista', 'Gestor', 'Diretor'] as const;
export type Level = (typeof LEVELS)[number];

export type CareerContext = {
  targetRole: string;
  targetLevel: Level | '';
  industry: string;
  country: string;
  /** Números que não podem ser publicados por política do empregador. */
  disclosure: string;
};

export const EMPTY_CONTEXT: CareerContext = {
  targetRole: '',
  targetLevel: '',
  industry: '',
  country: '',
  disclosure: '',
};

export type DossierInput = {
  context: CareerContext;
  sections: AssignedSection[];
  pii: PiiFinding[];
  periods: Period[];
  gaps: Gap[];
  shortTenures: Period[];
  /** Texto colado das vagas-alvo. Link não serve: o modelo não abre. */
  jobs: string[];
  now?: Date;
};

const SECTION_TITLE: Record<SectionKind, string> = {
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

const PII_TITLE: Record<string, string> = {
  email: 'e-mail',
  telefone: 'telefone',
  cpf: 'CPF',
  rg: 'documento de identidade',
  cep: 'CEP',
  endereco: 'endereço',
  nascimento: 'data de nascimento',
  idade: 'idade',
  'estado-civil': 'estado civil',
  sexo: 'sexo',
};

const fmt = (ym: YearMonth) => `${String(ym.month).padStart(2, '0')}/${ym.year}`;

const months = (n: number) => {
  const years = Math.floor(n / 12);
  const rest = n % 12;
  return (
    [years > 0 && `${years} ano${years > 1 ? 's' : ''}`, rest > 0 && `${rest} meses`]
      .filter(Boolean)
      .join(' e ') || 'menos de um mês'
  );
};

/** Texto da seção sem as linhas de título e sem dado pessoal. */
const bodyOf = (section: AssignedSection): string =>
  redact(
    section.text
      .split('\n')
      .filter((line) => detectHeading(line) === null)
      .join('\n'),
  ).text.trim();

const field = (label: string, value: string) =>
  `- **${label}:** ${value.trim() || '(não informado)'}`;

/** Contexto que a Fase 3 pediria. Vem antes para o modelo não ter que perguntar. */
function contextBlock(context: CareerContext): string {
  const lines = [
    '## Respostas antecipadas às perguntas da Fase 3',
    '',
    field('Cargo-alvo', context.targetRole),
    field('Nível-alvo', context.targetLevel),
    field('Setor / tipo de empregador', context.industry),
    field('País / mercado', context.country),
    field('Restrições de divulgação', context.disclosure),
  ];

  if (context.targetRole.trim() === '') {
    lines.push(
      '',
      '> **Sem cargo-alvo definido.** Não peça que a pessoa decida no vazio, e',
      '> não siga para a reescrita sem direção: derive de 2 a 3 direções',
      '> plausíveis a partir do histórico, descreva cada uma em uma linha e',
      '> peça que ela escolha uma ou proponha uma quarta.',
    );
  }

  return lines.join('\n');
}

/**
 * O documento, seção a seção, na ordem canônica.
 *
 * Passa por `redact` de novo aqui de propósito. A UI já redige na entrada,
 * mas este é o último ponto antes do texto sair do app — e a regra de PII é
 * invariante de código, não promessa de que ninguém esqueceu. A redação é
 * idempotente: o rótulo `[E-MAIL]` não casa com nenhum padrão.
 */
function documentBlock(sections: AssignedSection[]): string {
  const byKind = new Map<SectionKind, string[]>();
  for (const section of sections) {
    // A linha de título vira o cabeçalho do bloco; repeti-la dentro do texto
    // só duplica, e ainda estraga a contagem de caracteres da seção.
    const text = bodyOf(section);
    if (text === '') continue;
    byKind.set(section.kind, [...(byKind.get(section.kind) ?? []), text]);
  }

  const blocks = SECTION_ORDER.filter((kind) => byKind.has(kind)).map((kind) =>
    [`### ${SECTION_TITLE[kind]}`, '', byKind.get(kind)!.join('\n')].join('\n'),
  );

  return [
    '## Documento',
    '',
    'Texto extraído do arquivo original, já com os dados pessoais removidos.',
    'As seções foram conferidas pela pessoa antes de gerar este dossiê.',
    '',
    blocks.join('\n\n'),
  ].join('\n');
}

/**
 * Achados que saíram de aritmética e de regex, não de leitura.
 *
 * Vêm marcados como calculados de propósito: são a parte da análise em que o
 * modelo não deve recontar nada, só usar.
 */
function findingsBlock(input: DossierInput): string {
  const now = input.now ?? new Date();
  const lines = [
    '## Achados determinísticos',
    '',
    'Calculados pelo aplicativo a partir do texto — datas, contagens e padrões.',
    'Não recalcule nem contradiga: use como dado de entrada.',
    '',
  ];

  if (input.periods.length > 0) {
    lines.push(
      `- **Períodos reconhecidos na experiência:** ${input.periods.length}`,
      ...input.periods.map(
        (p) =>
          `  - ${fmt(p.start)} – ${p.end ? fmt(p.end) : 'atual'} (${months(durationMonths(p, now))})` +
          (p.precision === 'year' ? ' — o documento só declarou o ano' : ''),
      ),
    );
  } else {
    lines.push('- **Períodos reconhecidos na experiência:** nenhum');
  }

  lines.push(
    input.gaps.length > 0
      ? `- **Lacunas entre empregos:** ${input.gaps
          .map((g) => `${fmt(g.from)} a ${fmt(g.to)} (${months(g.months)})`)
          .join('; ')}`
      : '- **Lacunas entre empregos:** nenhuma acima de 4 meses',
  );

  lines.push(
    input.shortTenures.length > 0
      ? `- **Permanências abaixo de 12 meses:** ${input.shortTenures
          .map((p) => `${fmt(p.start)} – ${p.end ? fmt(p.end) : 'atual'}`)
          .join('; ')}`
      : '- **Permanências abaixo de 12 meses:** nenhuma',
  );

  const pii = Object.entries(summarizePii(input.pii));
  lines.push(
    pii.length > 0
      ? `- **Dados pessoais encontrados e removidos:** ${pii
          .map(([kind, count]) => `${PII_TITLE[kind] ?? kind}${count > 1 ? ` (${count}×)` : ''}`)
          .join(', ')}. Sinalize uma vez, na Fase 2, quais não deveriam estar num documento para o país-alvo — e siga sem mencioná-los de novo.`
      : '- **Dados pessoais encontrados:** nenhum',
  );

  const resumo = input.sections
    .filter((s) => s.kind === 'resumo')
    .map(bodyOf)
    .join('\n');
  if (resumo !== '') {
    const about = checkField('about', resumo);
    lines.push(
      `- **Resumo:** ${about.length} caracteres. O campo "Sobre" do LinkedIn aceita ${LINKEDIN.about}` +
        (about.fits ? '.' : ` — está ${-about.remaining} acima do limite.`),
    );
  }

  const headline = input.sections
    .filter((s) => s.kind === 'header')
    .flatMap((s) => bodyOf(s).split('\n').slice(1))
    .map((l) => l.trim())
    .find((l) => l !== '');
  if (headline) {
    lines.push(
      `- **Segunda linha do cabeçalho:** ${countChars(headline)} caracteres; o headline do LinkedIn aceita ${LINKEDIN.headline}.`,
    );
  }

  return lines.join('\n');
}

function jobsBlock(jobs: string[]): string {
  const filled = jobs.map((j) => j.trim()).filter((j) => j !== '');
  if (filled.length === 0) {
    return [
      '## Vagas-alvo',
      '',
      'Nenhuma vaga colada. Sem elas, a comparação com o vocabulário real das',
      'vagas não pode ser feita — diga isso explicitamente em vez de inferir o',
      'que as vagas pediriam.',
    ].join('\n');
  }

  return [
    '## Vagas-alvo',
    '',
    'Texto colado pela pessoa, não link.',
    '',
    ...filled.map((job, i) => `### Vaga ${i + 1}\n\n${job}`),
  ].join('\n');
}

/** O dossiê inteiro, pronto para colar em qualquer chat. */
export function buildDossier(input: DossierInput): string {
  return [
    CAREER_PROMPT,
    '',
    '═══════════════════════════════════════════',
    'CASO A ANALISAR',
    '═══════════════════════════════════════════',
    '',
    contextBlock(input.context),
    '',
    documentBlock(input.sections),
    '',
    findingsBlock(input),
    '',
    jobsBlock(input.jobs),
    '',
  ].join('\n');
}
