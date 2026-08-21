/**
 * Derivador de métricas — Fase 3 assistida.
 *
 * A regra do CLAUDE.md é clara: métrica ausente vira `[FALTA NÚMERO]`, nunca
 * estimativa. Mas "avisar que falta" não ajuda a pessoa a lembrar o número
 * real. Este módulo acha bullets de experiência sem nenhum dígito — resultado
 * sem resultado medido — e oferece perguntas fixas por categoria (frequência,
 * volume, escala) para puxar o número da memória.
 *
 * O que a pessoa escreve na resposta vira número confirmado: entra no
 * dossiê como resposta antecipada da Fase 3, no mesmo lugar de qualquer
 * outro dado que o formulário já coleta. O app não infere o número — só
 * pergunta.
 */

export type MetricCategory = 'frequencia' | 'volume' | 'escala';

export const METRIC_QUESTIONS: Record<MetricCategory, { label: string; question: string }> = {
  frequencia: {
    label: 'Frequência / Tempo',
    question: 'Quantas vezes por semana isso acontecia? Quanto tempo demorava antes e depois?',
  },
  volume: {
    label: 'Volume / Contagem',
    question:
      'Quantos clientes, alunos, pacientes, chamados ou contratos você gerenciava por mês?',
  },
  escala: {
    label: 'Escala relativa',
    question: 'Era a maior equipe da unidade? O orçamento reduziu pela metade ou dobrou?',
  },
};

export type MissingMetricLine = {
  quote: string;
};

// Abaixo disso é cargo, empresa, cidade ou rótulo — não um bullet de
// resultado. O que sobra depois de juntar as linhas quebradas pelo pdfjs
// costuma passar de 40 caracteres com folga; título de cargo raramente passa.
const MIN_LEN = 40;

const BULLET_MARK = /^[-•*▪–—]\s*/;

/**
 * Um "parágrafo" é uma sequência de linhas não-vazias que o `pdfjs` quebrou
 * por causa da largura da página, não por pontuação — junta de volta antes
 * de decidir se tem número. Quebra em unidade nova a cada linha em branco,
 * cada marcador de lista, ou cada linha de data.
 *
 * O parágrafo que termina bem em cima de uma linha de data é cargo/empresa
 * — cabeçalho do vínculo, não texto de resultado — e sai marcado como tal
 * pra não virar candidato a bullet sem número.
 */
function paragraphs(
  text: string,
  hasPeriod: (line: string) => boolean,
): { text: string; isHeader: boolean }[] {
  const out: { text: string; isHeader: boolean }[] = [];
  let buffer: string[] = [];

  const flush = (isHeader: boolean) => {
    if (buffer.length > 0) {
      out.push({ text: buffer.join(' ').replace(/\s+/g, ' ').trim(), isHeader });
    }
    buffer = [];
  };

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (line === '') {
      flush(false);
      continue;
    }
    if (hasPeriod(line)) {
      flush(true);
      continue;
    }
    if (BULLET_MARK.test(line)) flush(false);
    buffer.push(line.replace(BULLET_MARK, ''));
  }
  flush(false);

  return out;
}

/** Bullets de experiência sem nenhum dígito, na ordem em que aparecem. */
export function findMissingMetrics(
  experienceText: string,
  hasPeriod: (line: string) => boolean,
): MissingMetricLine[] {
  return paragraphs(experienceText, hasPeriod)
    .filter((p) => !p.isHeader && p.text.length >= MIN_LEN && !/\d/.test(p.text))
    .map((p) => ({ quote: p.text }));
}
