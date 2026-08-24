/**
 * Evidência de escopo no documento.
 *
 * NÃO é uma classificação de senioridade, e o desenho evita virar uma. A
 * Fase 1 do prompt manda enquadrar em Júnior→Diretor por escopo de decisão,
 * de responsabilidade e por liderança, com o título formal tendo o MENOR
 * peso. Um chat lendo o PDF cru faz o contrário: lê "Gerente" no cargo e
 * devolve "Gestor". Este módulo entrega os trechos que sustentam cada eixo,
 * já separados, para que o veredito saia da evidência e não do crachá.
 *
 * O veredito continua sendo do modelo externo. Decidir se "estruturei o
 * processo" é Pleno ou Sênior depende de contexto, setor e porte — é
 * julgamento de prosa. A regra 1 do CLAUDE.md corta nos dois sentidos:
 * nada de LLM para o que TypeScript resolve, e nada de TypeScript fingindo
 * resolver o que precisa de julgamento. Por isso, deliberadamente:
 *
 * - **não há faixa** dentro do eixo (executar / definir como / definir o quê);
 * - **não há contagem nem pontuação** — oito matches fracos parecem melhor
 *   que um forte, e qualquer número ao lado de um eixo é lido como nota;
 * - **nenhum parágrafo é descartado.** É marca-texto, não filtro: o que não
 *   casou sai em `unclassified`. Voz passiva e redação que a lista de termos
 *   não prevê custam uma dica, nunca uma prova escondida.
 *
 * Comprovado × prometido sai da seção, sem heurística: sinal dentro de
 * Experiência está preso a um vínculo com data e empresa; o mesmo sinal no
 * Resumo ou em Competências é auto-declaração. "Liderança" numa lista de
 * competências não é evidência de liderança — é a coluna *prometido* da
 * regra 5, e um detector ingênuo a trataria como falso positivo.
 */

import { stripAccents } from './companies';
import { MIN_LEN, paragraphs } from './metrics';
import type { AssignedSection, SectionKind } from './sections';

export type ScopeAxis = 'decisao' | 'responsabilidade' | 'lideranca';

export const AXIS_LABEL: Record<ScopeAxis, string> = {
  decisao: 'Escopo de decisão',
  responsabilidade: 'Escopo de responsabilidade',
  lideranca: 'Liderança',
};

/**
 * O que a ausência significa. Nunca "não existe" — o app não pode afirmar
 * isso sobre a carreira de ninguém, só sobre o que o detector reconheceu.
 */
export const AXIS_EMPTY: Record<ScopeAxis, string> = {
  decisao: 'O detector não encontrou verbo de decisão nas linhas de Experiência.',
  responsabilidade:
    'O detector não encontrou indicador de volume, orçamento ou abrangência nas linhas de Experiência.',
  lideranca: 'O detector não encontrou termo de liderança nas linhas de Experiência.',
};

export type ScopeEvidence = {
  axis: ScopeAxis;
  /** Trecho verbatim do documento. Ver CLAUDE.md > citação obrigatória. */
  quote: string;
};

export type ScopePanel = {
  /** Sinal dentro de Experiência: preso a um vínculo com data e empresa. */
  proven: ScopeEvidence[];
  /** O mesmo sinal no Resumo ou em Competências: auto-declaração. */
  claimed: ScopeEvidence[];
  /**
   * Linhas de Experiência que o detector não reconheceu. Vão para a tela,
   * não para o dossiê — lá o texto de Experiência já aparece inteiro.
   */
  unclassified: string[];
  /** Eixos sem nenhuma evidência em `proven`. */
  emptyAxes: ScopeAxis[];
};

/**
 * Radicais, não palavras: `lider` cobre liderei, liderança, líder e
 * lideranças de uma vez. O casamento roda sobre texto sem acento, senão
 * "líder" escapa — mesmo motivo do `stripAccents` em companies.ts.
 *
 * As formas nominais estão aqui de propósito: é onde a voz passiva se
 * esconde ("responsável por", "sob minha coordenação").
 *
 * `needsNumber` existe porque "clientes" e "unidades" aparecem em quase todo
 * currículo. Sem dígito no mesmo parágrafo não é indicador de escopo, é
 * vocabulário — e o eixo viraria ruído, que é o que este desenho evita.
 */
const TERMS: { axis: ScopeAxis; pattern: string; needsNumber?: boolean }[] = [
  // Escopo de decisão — pt
  { axis: 'decisao', pattern: 'defin' },
  { axis: 'decisao', pattern: 'decid' },
  { axis: 'decisao', pattern: 'estrutur' },
  { axis: 'decisao', pattern: 'implant' },
  { axis: 'decisao', pattern: 'redesenh' },
  { axis: 'decisao', pattern: 'reformul' },
  { axis: 'decisao', pattern: 'concebi' },
  { axis: 'decisao', pattern: 'estabelec' },
  { axis: 'decisao', pattern: 'prioriz' },
  { axis: 'decisao', pattern: 'criei' },
  { axis: 'decisao', pattern: 'criacao d' },
  { axis: 'decisao', pattern: 'propus' },
  // Escopo de decisão — en
  { axis: 'decisao', pattern: 'establish' },
  { axis: 'decisao', pattern: 'restructur' },
  { axis: 'decisao', pattern: 'overhaul' },
  { axis: 'decisao', pattern: 'prioriti' },
  { axis: 'decisao', pattern: 'creat' },

  // Escopo de responsabilidade — pt
  { axis: 'responsabilidade', pattern: 'orcament' },
  { axis: 'responsabilidade', pattern: 'faturament' },
  { axis: 'responsabilidade', pattern: 'receita' },
  { axis: 'responsabilidade', pattern: 'responsavel por' },
  { axis: 'responsabilidade', pattern: 'sob minha' },
  { axis: 'responsabilidade', pattern: 'gestao d' },
  { axis: 'responsabilidade', pattern: 'carteira d' },
  { axis: 'responsabilidade', pattern: 'ambito (nacional|regional|global)' },
  { axis: 'responsabilidade', pattern: 'clientes', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'usuarios', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'unidades', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'filiais', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'estados', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'paises', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'contratos', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'chamados', needsNumber: true },
  // Escopo de responsabilidade — en
  { axis: 'responsabilidade', pattern: 'budget' },
  { axis: 'responsabilidade', pattern: 'revenue' },
  { axis: 'responsabilidade', pattern: 'responsible for' },
  { axis: 'responsabilidade', pattern: 'accountable for' },
  { axis: 'responsabilidade', pattern: 'owner(ship)? of' },
  { axis: 'responsabilidade', pattern: 'portfolio of' },
  { axis: 'responsabilidade', pattern: '(customers|clients)', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'users', needsNumber: true },
  { axis: 'responsabilidade', pattern: 'countries', needsNumber: true },

  // Liderança — pt
  { axis: 'lideranca', pattern: 'lider' },
  { axis: 'lideranca', pattern: 'gerenci' },
  { axis: 'lideranca', pattern: 'coorden' },
  { axis: 'lideranca', pattern: 'subordinad' },
  { axis: 'lideranca', pattern: 'reportavam' },
  { axis: 'lideranca', pattern: 'mentor' },
  { axis: 'lideranca', pattern: 'chefi' },
  // "equipe" sozinho pega "trabalhei em equipe", que é o oposto de
  // evidência de liderança. Só conta com complemento.
  { axis: 'lideranca', pattern: 'equipe (de|com) ' },
  { axis: 'lideranca', pattern: 'time (de|com) ' },
  // Liderança — en
  { axis: 'lideranca', pattern: 'led\\b' },
  { axis: 'lideranca', pattern: 'leader' },
  { axis: 'lideranca', pattern: 'manag' },
  { axis: 'lideranca', pattern: 'supervis' },
  { axis: 'lideranca', pattern: 'coach' },
  { axis: 'lideranca', pattern: 'team (of|with) ' },
  { axis: 'lideranca', pattern: 'direct report' },
  { axis: 'lideranca', pattern: 'headcount' },
];

const MATCHERS = TERMS.map((t) => ({ ...t, re: new RegExp(`\\b${t.pattern}`) }));

export const AXES: ScopeAxis[] = ['decisao', 'responsabilidade', 'lideranca'];

/**
 * Seções onde um sinal de escopo é auto-declaração, não vínculo comprovado.
 *
 * `header` ficou de fora depois de rodar contra os currículos reais: ali mora
 * nome, contato e URL de perfil, e a lista de "Top Skills" do LinkedIn vem
 * colada no mesmo bloco. O que casava era quase sempre isso, e a citação saía
 * carregando a linha de identificação junto. O headline, que é o sinal que
 * valeria a pena, o dossiê já reporta em separado.
 */
const CLAIM_SECTIONS: SectionKind[] = ['resumo', 'competencias'];

/**
 * Cada frase é uma citação; o parágrafo não.
 *
 * Currículo sem marcador de lista e sem linha em branco — que é a maioria —
 * faz `paragraphs` devolver o bloco inteiro do vínculo, do cargo até o último
 * resultado. Citar isso como evidência de um eixo é citar o emprego todo, e a
 * regra 3 do CLAUDE.md pede trecho, não parágrafo. Continua verbatim: o corte
 * é em fim de frase, sem reescrever nada.
 */
const SENTENCE_SPLIT = /(?<=[.;])\s+/;

const HAS_NUMBER = /\d/;

/** Eixos que o parágrafo aciona, sem repetir eixo. */
function axesOf(quote: string): ScopeAxis[] {
  const flat = stripAccents(quote).toLowerCase();
  const hasNumber = HAS_NUMBER.test(flat);
  const hit = new Set<ScopeAxis>();

  for (const m of MATCHERS) {
    if (m.needsNumber && !hasNumber) continue;
    if (m.re.test(flat)) hit.add(m.axis);
  }

  return AXES.filter((a) => hit.has(a));
}

const textOf = (sections: AssignedSection[], kinds: SectionKind[]) =>
  sections
    .filter((s) => kinds.includes(s.kind))
    .map((s) => s.text)
    .join('\n');

/**
 * Uma evidência por eixo e por frase. Se nenhuma frase isolada casar — o
 * termo ficou espalhado no corte —, o parágrafo inteiro serve de citação.
 */
function evidenceIn(paragraph: string): ScopeEvidence[] {
  const found: ScopeEvidence[] = [];

  for (const raw of paragraph.split(SENTENCE_SPLIT)) {
    const quote = raw.trim();
    if (quote === '') continue;
    for (const axis of axesOf(quote)) found.push({ axis, quote });
  }

  return found.length > 0 ? found : axesOf(paragraph).map((axis) => ({ axis, quote: paragraph }));
}

export function findScopeEvidence(sections: AssignedSection[]): ScopePanel {
  const proven: ScopeEvidence[] = [];
  const claimed: ScopeEvidence[] = [];
  const unclassified: string[] = [];

  for (const p of paragraphs(textOf(sections, ['experiencia']))) {
    // Cargo/empresa não é texto de resultado — `paragraphs` já marca.
    if (p.isHeader) continue;

    const found = evidenceIn(p.text);
    if (found.length > 0) {
      proven.push(...found);
    } else if (p.text.length >= MIN_LEN) {
      unclassified.push(p.text);
    }
  }

  for (const p of paragraphs(textOf(sections, CLAIM_SECTIONS))) {
    // Sem piso de tamanho: em Competências a evidência é uma palavra solta.
    claimed.push(...evidenceIn(p.text));
  }

  return {
    proven,
    claimed,
    unclassified,
    emptyAxes: AXES.filter((a) => !proven.some((e) => e.axis === a)),
  };
}
