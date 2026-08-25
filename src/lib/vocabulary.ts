/**
 * Vocabulário das vagas coladas, contado.
 *
 * A tabela de palavras-chave é um entregável do prompt, e hoje ela sai do
 * modelo: ele lê as vagas, decide de cabeça quais termos são importantes e
 * escreve a tabela. Contar quantas vagas trazem cada termo é aritmética sobre
 * texto, e aritmética é trabalho de TypeScript — o modelo fica com o que só
 * ele faz, que é dizer o que o termo significa para esta carreira.
 *
 * O sinal que importa não é a contagem bruta: é **em quantas vagas** o termo
 * aparece. Um termo em quatro das quatro vagas é o vocabulário do mercado; o
 * mesmo termo repetido oito vezes numa vaga só é o jeito de escrever daquela
 * empresa. Por isso a ordenação é por número de vagas primeiro.
 *
 * Frequência simples, não TF-IDF: não há corpus de referência aqui, e inventar
 * um peso a partir de duas ou três vagas seria dar ar de estatística a nada.
 *
 * `present` é match literal contra o documento da pessoa. É a coluna que a
 * Fase 4 usa para não afirmar que um termo "já aparece" quando não aparece.
 */

import { stripAccents } from './companies';

export type VocabularyTerm = {
  /** O termo como aparece na primeira vaga que o traz. */
  term: string;
  /** Em quantas vagas ele aparece. */
  jobs: number;
  /** Total de ocorrências em todas as vagas. */
  count: number;
  /** O termo aparece literalmente no documento da pessoa. */
  present: boolean;
};

/**
 * Palavras que aparecem em qualquer texto em português e não dizem nada sobre
 * a vaga. Sem elas a tabela inteira seria "de", "para" e "com".
 */
const STOPWORDS = new Set(
  `a as o os um uma uns umas de do da dos das em no na nos nas por pelo pela para com sem sob
   sobre entre ate e ou mas que se como quando onde qual quais quem cujo ao aos à às
   ser estar ter haver fazer sao eh foi era sera tem tenha temos vai vao pode podem deve devem
   nao sim tambem mais menos muito muita muitos muitas todo toda todos todas outro outra outros
   outras mesmo mesma seu sua seus suas nosso nossa este esta isso aquele aquela
   voce nos eles elas ele ela lhe seja sejam sendo tendo apos antes durante cada
   vaga vagas empresa candidato candidata candidatos profissional profissionais area areas
   atividades atividade requisitos requisito desejavel obrigatorio diferencial beneficios
   trabalho trabalhar equipe funcao cargo nivel local horario contrato regime`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * Pedaços do texto em que um par de palavras vizinhas ainda é um termo.
 *
 * A pontuação corta: "renda fixa, renda variável" tem dois termos e não um
 * terceiro chamado "fixa renda". Sem este corte a tabela enchia de pares que
 * atravessavam vírgula e ponto final.
 */
const SEGMENT = /[^.,;:!?()\n]+/g;

const WORD = /[\p{L}\p{N}]+/gu;

/** O termo conta quando não é palavra de ligação nem palavra curta demais. */
const isUseful = (word: string) => word.length > 2 && !STOPWORDS.has(stripAccents(word).toLowerCase());

/** Termos de uma vaga: palavras úteis e pares de palavras úteis vizinhas. */
function termsOf(text: string): Map<string, { term: string; count: number }> {
  const found = new Map<string, { term: string; count: number }>();

  const add = (term: string) => {
    const key = stripAccents(term).toLowerCase();
    const entry = found.get(key);
    // A forma acentuada da primeira ocorrência, para a tabela ficar legível.
    if (entry) entry.count += 1;
    else found.set(key, { term, count: 1 });
  };

  for (const segment of text.match(SEGMENT) ?? []) {
    const tokens = segment.match(WORD) ?? [];
    tokens.forEach((word, i) => {
      if (!isUseful(word)) return;
      add(word);
      const next = tokens[i + 1];
      if (next !== undefined && isUseful(next)) add(`${word} ${next}`);
    });
  }

  return found;
}

/**
 * Termos das vagas, do mais espalhado para o mais concentrado.
 *
 * `document` é o texto da pessoa, já redigido. Um termo que só aparece numa
 * vaga fica de fora quando há mais de uma: com duas ou mais vagas coladas, o
 * que aparece em uma só é vocabulário de uma empresa, não do mercado.
 */
export function jobVocabulary(jobs: string[], document: string): VocabularyTerm[] {
  const filled = jobs.map((j) => j.trim()).filter((j) => j !== '');
  if (filled.length === 0) return [];

  const perJob = filled.map(termsOf);
  const flatDocument = stripAccents(document).toLowerCase();

  const merged = new Map<string, VocabularyTerm>();
  for (const job of perJob) {
    for (const [key, { term, count }] of job) {
      const entry = merged.get(key);
      if (entry) {
        entry.jobs += 1;
        entry.count += count;
      } else {
        merged.set(key, { term, jobs: 1, count, present: flatDocument.includes(key) });
      }
    }
  }

  const minJobs = filled.length > 1 ? 2 : 1;

  return [...merged.values()]
    .filter((t) => t.jobs >= minJobs)
    .sort((a, b) => b.jobs - a.jobs || b.count - a.count || a.term.localeCompare(b.term));
}
