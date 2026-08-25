/**
 * Montagem do dossiê: prompt + contexto + documento + achados + vagas.
 *
 * Tudo aqui é concatenação determinística. O prompt vem inteiro de
 * `prompt.ts`, que o lê do documento de origem — nada é reescrito aqui.
 *
 * Regra que este módulo precisa manter sozinho: o valor de um dado pessoal
 * nunca entra no dossiê. Só o tipo e a quantidade. Ver CLAUDE.md > PII.
 */

import type { Analysis } from './analysis';
import { durationMonths, monthsBetween, totalMonths, type YearMonth } from './dates';
import type { MissingMetricLine } from './metrics';
import { checkField, countChars, LINKEDIN } from './limits';
import { stripAccents } from './companies';
import { redact, summarizePii, type PiiFinding, type PiiKind } from './pii';
import { CAREER_PROMPT } from './prompt';
import { sectionNames } from './repetition';
import {
  acronymsIn,
  findRequirements,
  inDocument,
  KIND_LABEL,
  type Requirement,
} from './requirements';
import { jobVocabulary } from './vocabulary';
import { AXES, AXIS_EMPTY, AXIS_LABEL, type ScopePanel } from './scope';
import {
  detectHeading,
  SECTION_LABEL,
  SECTION_ORDER,
  type AssignedSection,
  type SectionKind,
} from './sections';

/** Níveis do CLAUDE.md. Vazio = a pessoa não sabe, e isso muda a Fase 1. */
export const LEVELS = ['Júnior', 'Pleno', 'Sênior', 'Especialista', 'Gestor', 'Diretor'] as const;
export type Level = (typeof LEVELS)[number];

/** Valores aceitos em `Distância entre os dois`, pela Fase 1 do prompt. */
export const DISTANCES = ['nenhuma', 'meio degrau', 'um degrau', 'dois ou mais'] as const;

/**
 * Tipo de artefato, que a Fase 1 do prompt classifica primeiro.
 *
 * Muda as convenções (currículo BR aceita foto, LinkedIn não), muda quais
 * limites de caractere existem, e muda o que o modelo deve declarar como
 * não avaliado quando só vem um dos dois documentos.
 */
export type ArtifactKind = 'linkedin' | 'curriculo' | 'ambos';

export const ARTIFACT_LABEL: Record<ArtifactKind, string> = {
  linkedin: 'Perfil do LinkedIn',
  curriculo: 'Currículo',
  ambos: 'Perfil do LinkedIn e currículo',
};

/** Só o LinkedIn trunca campo. Num currículo em PDF esse limite não existe. */
export const hasLinkedIn = (artifact: ArtifactKind) => artifact !== 'curriculo';

export type CareerContext = {
  artifact: ArtifactKind;
  targetRole: string;
  targetLevel: Level | '';
  industry: string;
  country: string;
  /** Números que não podem ser publicados por política do empregador. */
  disclosure: string;
};

export const EMPTY_CONTEXT: CareerContext = {
  artifact: 'curriculo',
  targetRole: '',
  targetLevel: '',
  industry: '',
  country: '',
  disclosure: '',
};

/**
 * O que o dossiê precisa, separado por origem: `analysis` é o que se derivou
 * do documento; o resto é o que a pessoa respondeu na interface.
 */
export type DossierInput = {
  analysis: Analysis;
  context: CareerContext;
  pii: PiiFinding[];
  /** Achado + resposta (vazia = ainda sem número) da Fase 3 assistida. */
  metrics: { finding: MissingMetricLine; answer: string }[];
  /** Texto colado das vagas-alvo. Link não serve: o modelo não abre. */
  jobs: string[];
  now?: Date;
};

const PII_TITLE: Record<PiiKind, string> = {
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

const formatYearMonth = (ym: YearMonth) => `${String(ym.month).padStart(2, '0')}/${ym.year}`;

/** Intervalo de um período, do jeito que o resto do bloco já escreve. */
const range = (p: { start: YearMonth; end: YearMonth | null }) =>
  `${formatYearMonth(p.start)} – ${p.end ? formatYearMonth(p.end) : 'atual'}`;

const plural = (n: number, singular: string, plural: string) =>
  `${n} ${n === 1 ? singular : plural}`;

const formatDuration = (n: number) => {
  const years = Math.floor(n / 12);
  const rest = n % 12;
  return (
    [years > 0 && plural(years, 'ano', 'anos'), rest > 0 && plural(rest, 'mês', 'meses')]
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

/**
 * Toda citação que sai do app passa por aqui.
 *
 * O texto já chega redigido da UI, e `redact` é idempotente — isto é a mesma
 * última linha de defesa que `bodyOf` aplica ao documento, pelo mesmo motivo:
 * a regra de PII é invariante de código, não confiança em quem chamou.
 */
const quote = (s: string) => redact(s).text;

/**
 * Prefixo de vínculo numa citação de métrica. Sem ele, duas atividades
 * idênticas em empresas diferentes chegam ao modelo como linhas repetidas —
 * e ele não tem como pedir o número certo para cada uma.
 */
const where = (m: MissingMetricLine) => (m.label ? `**${quote(m.label)}** — ` : '');

const field = (label: string, value: string) =>
  `- **${label}:** ${value.trim() || '(não informado)'}`;

/** Contexto que a Fase 3 pediria. Vem antes para o modelo não ter que perguntar. */
function contextBlock(context: CareerContext): string {
  const lines = [
    '## Respostas antecipadas às perguntas da Fase 3',
    '',
    // A Fase 1 classifica o tipo de artefato antes de qualquer coisa. Aqui
    // ele vem declarado: as convenções aplicáveis dependem disso.
    field('Tipo de artefato', ARTIFACT_LABEL[context.artifact]),
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

  // O prompt manda trabalhar com o que veio e sinalizar o que não pôde
  // avaliar. Sem o tipo declarado, o modelo adivinha — e adivinha errado
  // justamente quando o documento é curto.
  if (context.artifact !== 'ambos') {
    const ausente = context.artifact === 'linkedin' ? 'o currículo' : 'o perfil do LinkedIn';
    lines.push(
      '',
      `> **Veio só um documento.** ${ausente[0].toUpperCase()}${ausente.slice(1)} não foi`,
      '> fornecido. Trabalhe com o que tem e diga explicitamente, uma vez, o que',
      '> não pôde ser avaliado por causa disso.',
    );
  }

  return lines.join('\n');
}

/**
 * Em que ponto o caso está, calculado — não instruído.
 *
 * O dossiê não dizia onde começar, e o modelo parava depois das perguntas da
 * Fase 3 em todas as rodadas de teste, inclusive quando o formulário estava
 * inteiro preenchido. A instrução estática que mandava perguntar o que faltava
 * também não bastou: numa das rodadas ele perguntou um dos dois itens e
 * ignorou o outro, tendo duas sobreposições reais no documento.
 *
 * Então isto aqui não pede: mede. Cada requisito é uma conta sobre o que o app
 * já tem, e o que falta sai nomeado — pergunta que o modelo não precisa
 * descobrir que devia fazer.
 */
function phaseGate(input: DossierInput): { phase: 3 | 4; missing: string[] } {
  const { context, analysis, jobs, metrics } = input;
  const missing: string[] = [];

  if (context.targetRole.trim() === '') {
    missing.push('O cargo-alvo, que a pessoa ainda não declarou.');
  }

  if (jobs.every((j) => j.trim() === '')) {
    missing.push('O texto de 2 a 5 vagas-alvo, que ninguém colou.');
  }

  // Os dois vínculos mais recentes são os que sustentam o enquadramento de
  // nível. Número que falta num estágio de dez anos atrás não trava nada.
  const recent = new Set(
    analysis.stints
      .slice(-2)
      .map((s) => s.label),
  );
  const semNumero = metrics.filter(
    (m) => m.answer.trim() === '' && m.finding.label !== null && recent.has(m.finding.label),
  );
  if (semNumero.length > 0) {
    missing.push(
      `Os números de ${plural(semNumero.length, 'trecho', 'trechos')} dos dois vínculos mais` +
        ' recentes, listados abaixo em "Ainda sem número".',
    );
  }

  if (analysis.overlaps.length > 0) {
    missing.push(
      `O que eram os ${plural(analysis.overlaps.length, 'período sobreposto', 'períodos sobrepostos')}` +
        ' — cargo paralelo, consultoria, sociedade ou promoção registrada como vínculo novo.',
    );
  }

  return { phase: missing.length === 0 ? 4 : 3, missing };
}

/**
 * O cabeçalho de estado, antes de qualquer conteúdo.
 *
 * `FASE INICIAL` não manda pular o diagnóstico: as Fases 1 e 2 valem sempre.
 * Diz se a Fase 3 ainda tem o que perguntar — e, quando não tem, tira do
 * modelo a saída de parar ali.
 */
function stateBlock(input: DossierInput): string {
  const { phase, missing } = phaseGate(input);

  if (phase === 4) {
    return [
      'FASE INICIAL: 4',
      '',
      'As Fases 1 a 3 têm todo o insumo de que precisam: cargo-alvo, vagas,',
      'números dos vínculos recentes e ambiguidades de histórico já vieram',
      'preenchidos. Faça o diagnóstico das Fases 1 e 2, não repita as perguntas',
      'da Fase 3, e siga direto até a Fase 4. Não pare para pedir confirmação.',
    ].join('\n');
  }

  return [
    'FASE INICIAL: 3',
    '',
    'Faça o diagnóstico das Fases 1 e 2 e pare na Fase 3. Falta o seguinte, e',
    'é exatamente isto que você deve perguntar — nada além, e nada que já esteja',
    'respondido acima:',
    '',
    ...missing.map((m) => `- ${m}`),
  ].join('\n');
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
    [`### ${SECTION_LABEL[kind]}`, '', byKind.get(kind)!.join('\n')].join('\n'),
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
 * O que a pessoa respondeu, separado do que o documento diz.
 *
 * Bloco próprio, e de topo, por duas falhas medidas em rodadas diferentes.
 * Numa, as respostas estavam misturadas ao documento e o modelo criticou a
 * redação delas como se fossem texto do currículo. Noutra, estavam enterradas
 * como sub-item dentro dos achados determinísticos — e sumiram: eram a única
 * evidência quantificada de escopo e a única de liderança do dossiê, e o
 * enquadramento de nível saiu sem elas.
 *
 * Os trechos ainda sem número ficam aqui também, junto do que os responde: é
 * o mesmo material, e separá-los faria a pessoa procurar em dois lugares.
 */
function answersBlock(metrics: DossierInput['metrics']): string {
  if (metrics.length === 0) return '';

  const answered = metrics.filter((m) => m.answer.trim() !== '');
  const unanswered = metrics.filter((m) => m.answer.trim() === '');

  const lines = [
    '## Respostas da pessoa',
    '',
    'Não fazem parte do documento. São respostas dela às perguntas da Fase 3 que',
    'o aplicativo já fez, uma por trecho sem número. Não critique a redação: não',
    'é texto de currículo, é insumo confirmado para a Fase 4. Quando trouxerem',
    'escopo, volume ou liderança, cite-as no enquadramento de nível — em vários',
    'casos são a única evidência quantificada que existe.',
    '',
  ];

  lines.push(
    ...(answered.length > 0
      ? answered.map((m) => `- ${where(m.finding)}"${quote(m.finding.quote)}" → ${m.answer.trim()}`)
      : ['- Nenhuma resposta ainda.']),
  );

  if (unanswered.length > 0) {
    lines.push(
      '',
      `### Ainda sem número (${unanswered.length})`,
      '',
      'Mantenha `[FALTA NÚMERO: o que medir]` nesses trechos. Não estime, não use',
      'placeholder inventado, não troque por adjetivo.',
      '',
      ...unanswered.map((m) => `- ${where(m.finding)}"${quote(m.finding.quote)}"`),
    );
  }

  return lines.join('\n');
}

/**
 * Achados que saíram de aritmética e de regex, não de leitura.
 *
 * Vêm marcados como calculados de propósito: são a parte da análise em que o
 * modelo não deve recontar nada, só usar.
 */
function findingsBlock(input: DossierInput): string {
  const now = input.now ?? new Date();
  const { periods, overlaps, buzzwords, silentStints, repeated } = input.analysis;
  const lines = [
    '## Achados determinísticos',
    '',
    'Datas e contagens medidas pelo aplicativo sobre o texto. Não recalcule.',
    '',
    'São dados, não conclusões: o intervalo entre dois vínculos sai em meses, e',
    'se aquilo é lacuna de carreira, transição, estudo ou omissão, quem diz é',
    'você — com o que estiver no documento. O aplicativo não classifica nada aqui.',
    '',
  ];

  if (periods.length > 0) {
    lines.push(
      `- **Períodos reconhecidos na experiência (${periods.length}), do mais antigo ao mais recente:**`,
      // O vão entre um período e o próximo sai na sequência, sem limiar e sem
      // a palavra "lacuna". Antes disto o bloco emitia "nenhuma acima de 4
      // meses" — veredito calculado, ignorado em todas as rodadas de teste,
      // enquanto o bloco de evidência crua ao lado era usado.
      ...periods.flatMap((p, i) => {
        const line =
          `  - ${range(p)} (${formatDuration(durationMonths(p, now))})` +
          (p.precision === 'year' ? ' — o documento só declarou o ano' : '');
        const next = periods[i + 1];
        if (!next || !p.end) return [line];
        const between = monthsBetween(p.end, next.start);
        return between > 0
          ? [line, `    ↳ ${plural(between, 'mês', 'meses')} até o começo do próximo`]
          : [line];
      }),
    );
  } else {
    lines.push(
      '- **Períodos reconhecidos na experiência:** nenhum. O detector de datas não',
      '  achou intervalo no texto atribuído a Experiência — pode ser formato que ele',
      '  não cobre, ou seção fatiada errado. Não conclua que a pessoa não trabalhou.',
    );
  }

  // Cargo paralelo é o item 5 da Fase 3, que o app não coletava e o modelo
  // esquecia de perguntar em metade das rodadas. Sai como par de datas, sem
  // nome e sem interpretação: quem sabe o que aconteceu ali é a pessoa.
  if (overlaps.length > 0) {
    lines.push(
      `- **Períodos que correm ao mesmo tempo (${overlaps.length}):**`,
      ...overlaps.map(
        (o) =>
          `  - ${range(o.a)} e ${range(o.b)} dividem ${formatDuration(o.months)}`,
      ),
      '  - Pergunte o que eram — cargo paralelo, consultoria, sociedade, promoção' +
        ' registrada como vínculo novo — antes de tratar como trajetória sequencial.',
    );
  }

  // A Fase 4 proíbe repetir a mesma âncora de escala; a Fase 2 não tem o
  // espelho dessa regra. Sem isto, a mesma conquista contada duas vezes chega
  // como duas conquistas — e numa das rodadas ela foi elogiada como ponto
  // forte, com a frase inteira idêntica no Resumo e na Experiência.
  if (repeated.length > 0) {
    lines.push(
      `- **Frases idênticas em mais de uma seção (${repeated.length}):**`,
      ...repeated.map((r) => `  - Em ${sectionNames(r.sections)}: "${quote(r.quote)}"`),
    );
  }

  // Vínculo listado e não descrito é o defeito que o modelo sozinho não
  // aponta: quem lê um texto ausente não estranha nada. Sai como o detector
  // viu — não há linha entre esta data e a próxima —, sem veredito: currículo
  // de duas colunas imprime a descrição ao lado da data, e aí não falta nada.
  if (silentStints.length > 0) {
    lines.push(
      `- **Vínculos sem nenhuma linha de descrição abaixo da data (${silentStints.length}):**`,
      ...silentStints.map((s) => `  - ${range(s.period)} — ${s.label}`),
      '  - Confira no `## Documento` antes de cobrar: se a descrição estiver lá em' +
        ' outra posição, o detector é que não a viu.',
    );
  }

  // Permanência curta saía como campo próprio, com limiar de 12 meses. É a
  // mesma duração que já está na lista acima, com um veredito colado — e o
  // limiar não vale igual para estágio, obra e temporada. Sai a conta, fica
  // o dado.
  lines.push(
    buzzwords.length > 0
      ? `- **Termos genéricos encontrados:** ${buzzwords
          .map((b) => `"${b.quote}"`)
          .join(', ')}. Não reescreva por conta própria — aponte o trecho e peça reescrita no` +
        ' formato Ação + Método + Problema + Resultado, só com número que a pessoa confirmar.'
      : '- **Termos genéricos:** o detector não reconheceu nenhum termo da lista dele.' +
        ' A lista é curta e literal: ausência aqui é limite dela, não do documento.',
  );

  const pii = Object.entries(summarizePii(input.pii)) as [PiiKind, number][];
  lines.push(
    pii.length > 0
      ? `- **Dados pessoais encontrados e removidos:** ${pii
          .map(([kind, count]) => `${PII_TITLE[kind]}${count > 1 ? ` (${count}×)` : ''}`)
          .join(', ')}. Sinalize uma vez, na Fase 2, quais não deveriam estar num documento para o país-alvo — e siga sem mencioná-los de novo.`
      : '- **Dados pessoais encontrados:** nenhum',
  );

  // Limite de caractere é achado de LinkedIn. Medir um currículo em PDF
  // contra os 2600 do campo "Sobre" seria entregar como calculado uma
  // restrição que não existe naquele documento.
  const resumo = hasLinkedIn(input.context.artifact)
    ? input.analysis.sections
        .filter((s) => s.kind === 'resumo')
        .map(bodyOf)
        .join('\n')
    : '';
  if (resumo !== '') {
    const about = checkField('about', resumo);
    lines.push(
      `- **Resumo:** ${about.length} caracteres. O campo "Sobre" do LinkedIn aceita ${LINKEDIN.about}` +
        (about.fits ? '.' : ` — está ${-about.remaining} acima do limite.`),
    );
  }

  const headline = input.analysis.sections
    .filter((s) => hasLinkedIn(input.context.artifact) && s.kind === 'header')
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

/**
 * Evidência de escopo — bloco separado dos achados determinísticos de
 * propósito. Achado é conta fechada; isto é matéria-prima citada, e misturar
 * os dois faria o modelo ler a tabela como conclusão. O aviso no topo existe
 * pelo mesmo motivo: tabela colada em chat é lida como veredito.
 */
function scopeBlock(scope: ScopePanel): string {
  const lines = [
    '## Evidência de escopo',
    '',
    'Trechos agrupados por match literal de termos, não por análise.',
    '**Não são uma classificação de nível.** Ausência num eixo indica que o',
    'aplicativo não reconheceu o termo, não que a evidência não exista — a',
    'redação em voz passiva escapa da lista. O enquadramento é seu, pela',
    'Fase 1.',
    '',
    // O formato canônico existe para o validador poder rodar: sem uma linha
    // com valor único, "Especialista / Coordenador Técnico (Pleno a Sênior)"
    // é indistinguível de uma classificação legítima. A justificativa em
    // prosa continua sendo bem-vinda — abaixo das três linhas, não dentro
    // delas. Ver src/lib/validate.ts > checkLevelFields.
    'Os três campos da Fase 1 saem em três linhas próprias, cada uma com **um**',
    'valor, sem barra e sem parênteses:',
    '',
    '```',
    `NIVEL_COMPROVADO: <${LEVELS.join(' | ')}>`,
    `NIVEL_PROMETIDO: <${LEVELS.join(' | ')}>`,
    `DISTANCIA: <${DISTANCES.join(' | ')}>`,
    '```',
    '',
    'A justificativa de cada um vem em prosa depois do bloco.',
    '',
    '### Comprovado — sinal dentro de Experiência, preso a um vínculo',
  ];

  for (const axis of AXES) {
    const found = scope.proven.filter((e) => e.axis === axis);
    lines.push(
      '',
      `**${AXIS_LABEL[axis]}**`,
      ...(found.length > 0
        ? found.map((e) => `- "${quote(e.quote)}"`)
        : [`- ${AXIS_EMPTY[axis]}`]),
    );
  }

  // A auto-declaração é a coluna "prometido" da regra 5 do CLAUDE.md. Sai
  // separada justamente para não ser somada à evidência comprovada.
  lines.push('', '### Declarado — o mesmo sinal fora de Experiência, sem vínculo que sustente');
  lines.push(
    '',
    ...(scope.claimed.length > 0
      ? scope.claimed.map((e) => `- ${AXIS_LABEL[e.axis]}: "${quote(e.quote)}"`)
      : ['- Nenhum termo de escopo no Cabeçalho, no Resumo ou em Competências.']),
  );

  return lines.join('\n');
}

/**
 * Termos úteis de um texto curto, sem acento e sem palavra de ligação.
 *
 * Serve para medir sobreposição entre o cargo-alvo e o texto de uma vaga. É
 * comparação de palavra, não de significado: "Assessor de Investimentos" e
 * "Especialista em Renda Fixa" não se cruzam aqui, e é por isso que a saída é
 * "não contém nenhum termo", nunca "não tem a ver".
 */
const STOPWORDS = new Set(['de', 'da', 'do', 'e', 'ou', 'em', 'para', 'a', 'o', 'com', 'sr', 'jr']);

const terms = (s: string): string[] =>
  stripAccents(s)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

const mentions = (haystack: string, needle: string) =>
  stripAccents(haystack).toLowerCase().includes(stripAccents(needle).toLowerCase());

/**
 * O que o app sabe cruzar entre uma vaga e o resto do caso.
 *
 * Os dois cruzamentos nasceram do mesmo caso real. A pessoa declarou o
 * cargo-alvo e colou duas vagas de mercados incompatíveis; o modelo tratou as
 * duas como bifurcação simétrica, ignorou a direção declarada e gastou a
 * pergunta de maior prioridade pedindo que ela escolhesse de novo — o que o
 * prompt proíbe. E uma dessas vagas era de um ex-empregador dela, com três
 * anos de histórico interno, o fato que mais muda a recomendação: ninguém
 * cruzou o nome da empresa com o texto colado.
 *
 * Nenhum dos dois é veredito. O primeiro diz que não há palavra em comum, o
 * segundo diz que o nome aparece — o que isso significa é da pessoa e do
 * modelo.
 */
function jobNotes(job: string, input: DossierInput, n: number, odd: boolean): string[] {
  const out: string[] = [];
  const target = input.context.targetRole.trim();

  if (odd) {
    out.push(
      `> **Vaga ${n} diverge do cargo-alvo declarado.** O cargo-alvo é "${target}". A Vaga ${n}`,
      '> não contém nenhum dos termos do alvo. Trate como possível engano de colagem:',
      '> confirme numa linha se ela deve entrar na análise — não reabra a escolha de',
      '> direção, que já foi respondida.',
    );
  }

  // Um empregador com dois cargos vira dois vínculos e sairia duas vezes.
  const periods = new Map<string, string[]>();
  for (const s of input.analysis.stints) {
    if (s.company === null || s.company.length <= 3 || !mentions(job, s.company)) continue;
    periods.set(s.company, [...(periods.get(s.company) ?? []), range(s.period)]);
  }

  for (const [company, when] of periods) {
    out.push(
      `> **Vaga ${n} menciona empregador do histórico:** ${quote(company)}` +
        ` (${when.join(', ')}). Retorno a ex-empregador muda a recomendação — a pessoa` +
        ' já conhece a operação por dentro, e a rede interna dela continua lá.',
    );
  }

  return out.length > 0 ? ['', ...out] : [];
}

/**
 * Quais vagas destoam do cargo-alvo — e só quando *algumas* destoam.
 *
 * O achado é a assimetria. Se nenhuma vaga tem palavra em comum com o alvo, o
 * mais provável é que a pessoa tenha escrito o alvo com outras palavras, não
 * que tenha colado tudo errado; chamar cada vaga de engano nesse caso é pior
 * que ficar calado.
 */
function oddJobs(filled: string[], target: string): number[] {
  if (target.trim() === '' || filled.length < 2) return [];
  const wanted = terms(target);
  const off = filled.flatMap((job, i) => (wanted.some((t) => mentions(job, t)) ? [] : [i]));
  return off.length === filled.length ? [] : off;
}

/**
 * Requisito duro da vaga, com a modalidade que o texto declarou e a conta do
 * lado — nunca o veredito.
 *
 * A comparação de anos é subtração e sai daqui. Decidir se catorze meses a
 * menos eliminam a candidatura é julgamento de mercado, e continua sendo do
 * modelo. O que o app garante é que ele não vai afirmar que a pessoa "atende a
 * todos os pré-requisitos" sem que a conta tenha sido feita, nem transformar
 * um "diferencial" escrito na vaga em "certificação obrigatória".
 */
function requirementNotes(job: string, input: DossierInput, n: number): string[] {
  const found = findRequirements(job);
  if (found.length === 0) return [];

  const document = input.analysis.lines.join('\n');
  const months = totalMonths(input.analysis.periods, { now: input.now ?? new Date() });

  const detail = (r: Requirement): string => {
    if (r.kind === 'anos' && r.years !== undefined) {
      const diff = months - r.years * 12;
      return (
        `exige ${plural(r.years, 'ano', 'anos')}` +
        ` | somado no documento: ${formatDuration(months)}` +
        ` | diferença: ${diff < 0 ? '-' : '+'}${formatDuration(Math.abs(diff))}`
      );
    }
    if (r.kind === 'certificacao') {
      const siglas = acronymsIn(r.quote);
      if (siglas.length === 0) return 'nenhuma sigla nomeada na frase';
      return siglas
        .map((s) => `${s}: ${inDocument(document, s) ? 'aparece' : 'não aparece'} no documento`)
        .join(' | ');
    }
    return 'confira contra a seção correspondente do documento';
  };

  return [
    `- **Requisitos que a Vaga ${n} declara:**`,
    ...found.map(
      (r) =>
        `  - ${KIND_LABEL[r.kind]} (modalidade declarada: ${r.modality}) — ${detail(r)}` +
        `\n    - "${quote(r.quote)}"`,
    ),
    '  - A modalidade é a palavra que a vaga usou. Não promova "diferencial" a' +
      ' obrigatório, e não trate como cumprido o que não foi comparado.',
  ];
}

/**
 * Quantos termos a tabela mostra.
 *
 * Vinte cabem numa tela e cobrem o vocabulário que se repete. Abaixo disso a
 * contagem já é cauda longa, e uma tabela de duzentas linhas não é insumo:
 * é o texto das vagas de novo, em outra formatação.
 */
const VOCABULARY_ROWS = 20;

/** A tabela de palavras-chave, contada em vez de inferida. */
function vocabularyBlock(input: DossierInput): string[] {
  const terms = jobVocabulary(input.jobs, input.analysis.lines.join('\n'));
  if (terms.length === 0) return [];

  const shown = terms.slice(0, VOCABULARY_ROWS);
  return [
    '',
    '### Vocabulário das vagas, contado',
    '',
    'Contagem do aplicativo sobre o texto colado. Não recalcule, e não invente',
    'termo que não esteja aqui. "Vagas" é em quantas das vagas o termo aparece —',
    'é o que separa vocabulário do mercado do jeito de escrever de uma empresa.',
    '',
    '| Termo | Vagas | Ocorrências | Está no documento |',
    '| --- | --- | --- | --- |',
    ...shown.map(
      (t) => `| ${quote(t.term)} | ${t.jobs} | ${t.count} | ${t.present ? 'sim' : 'não'} |`,
    ),
    ...(terms.length > shown.length
      ? [
          '',
          `Mais ${plural(terms.length - shown.length, 'termo ficou', 'termos ficaram')}` +
            ' abaixo do corte da tabela.',
        ]
      : []),
  ];
}

function jobsBlock(input: DossierInput): string {
  const jobs = input.jobs;
  const filled = jobs.map((j) => j.trim()).filter((j) => j !== '');
  const odd = oddJobs(filled, input.context.targetRole);
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
    // A Fase 3 do prompt pede de 2 a 5 vagas. Uma só dá vocabulário de uma
    // empresa, não do mercado — e o modelo precisa saber disso antes de
    // apresentar a tabela de palavras-chave como se fosse do setor.
    ...(filled.length < 2
      ? [
          '',
          '> **Só uma vaga.** O alinhamento de palavras-chave sai do vocabulário',
          '> de um anúncio só. Trate como amostra de uma empresa, não do',
          '> mercado, e diga isso ao apresentar a tabela.',
        ]
      : []),
    '',
    ...filled.flatMap((job, i) => [
      `### Vaga ${i + 1}`,
      ...jobNotes(job, input, i + 1, odd.includes(i)),
      '',
      ...requirementNotes(job, input, i + 1),
      '',
      job,
      '',
    ]),
    ...vocabularyBlock(input),
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
    stateBlock(input),
    '',
    contextBlock(input.context),
    '',
    documentBlock(input.analysis.sections),
    '',
    answersBlock(input.metrics),
    '',
    findingsBlock(input),
    '',
    scopeBlock(input.analysis.scope),
    '',
    jobsBlock(input),
    '',
  ].join('\n');
}
