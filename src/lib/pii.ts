/**
 * Detecção e redação de dados pessoais.
 *
 * Roda no pré-processamento, antes de qualquer análise. O que sai daqui é o
 * texto que o resto do app enxerga: nenhum módulo posterior deve ver
 * telefone, e-mail ou documento. Ver CLAUDE.md > PII.
 *
 * Regex resolve isso inteiro. Nenhum modelo participa.
 */

export type PiiKind =
  | 'email'
  | 'telefone'
  | 'cpf'
  | 'rg'
  | 'cep'
  | 'endereco'
  | 'nascimento'
  | 'idade'
  | 'estado-civil'
  | 'sexo';

export type PiiFinding = {
  kind: PiiKind;
  /** Trecho verbatim encontrado. */
  quote: string;
  index: number;
};

/** Rótulo que substitui o trecho no texto redigido. */
const LABEL: Record<PiiKind, string> = {
  email: '[E-MAIL]',
  telefone: '[TELEFONE]',
  cpf: '[CPF]',
  rg: '[RG]',
  cep: '[CEP]',
  endereco: '[ENDEREÇO]',
  nascimento: '[DATA DE NASCIMENTO]',
  idade: '[IDADE]',
  'estado-civil': '[ESTADO CIVIL]',
  sexo: '[SEXO]',
};

/**
 * Ordem importa: em sobreposição, o primeiro padrão da lista vence.
 * Documento rotulado ganha de telefone, que ganha de endereço solto.
 */
const PATTERNS: [PiiKind, RegExp][] = [
  // Duas alternativas, e a ordem entre elas importa: primeiro o e-mail inteiro
  // numa linha só. A segunda só entra quando a primeira falha, que é o caso do
  // export de PDF do LinkedIn — a barra lateral estreita quebra o endereço no
  // meio ("...@gmail.c" / "om"). Na ordem inversa, o padrão tolerante a quebra
  // engoliria a linha seguinte junto.
  [
    'email',
    /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\n[A-Za-z0-9.-]*[A-Za-z]{2,}/g,
  ],
  ['cpf', /(?:CPF\s*:?\s*)?\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/gi],
  [
    'rg',
    /(?:RG|Carteira de Identidade|Identidade|Registro Geral)\s*:?\s*[A-Z]{0,2}[-\s]?[\d.]{5,15}-?\w?/gi,
  ],
  ['nascimento', /(?:data\s+de\s+)?nascimento\s*:?\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/gi],
  ['nascimento', /nascid[oa]\s+em\s+\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/gi],
  ['cep', /(?:CEP\s*:?\s*)?(?<!\d)\d{5}-\d{3}(?!\d)/gi],
  // O prefixo internacional é opcional, mas se vier, vem colado ao número:
  // o separador mora dentro do grupo, senão o espaço anterior entra na citação.
  [
    'telefone',
    /(?:(?:\(\s*\+?\d{2,3}\s*\)|\+\d{2,3})[\s-]*)?\(?(?<!\d)\d{2}\)?[\s.-]*(?:9[\s.]?)?\d{4}[\s.-]*\d{4}(?!\d)/g,
  ],
  [
    'endereco',
    /\b(?:rua|r\.|av\.|avenida|alameda|travessa|pra[çc]a|estrada|rodovia)\s+[^\n,]{3,60}(?:,\s*(?:n[º°.]?\s*)?\d{1,6})?(?:,\s*(?:apto?\.?|ap\.?|bloco|casa)[^\n,]{0,20})?/gi,
  ],
  ['sexo', /(?:sexo|g[êe]nero)\s*:?\s*(?:masculino|feminino|homem|mulher|m|f)\b\.?/gi],
  [
    'estado-civil',
    /(?:estado\s+civil\s*:?\s*)?\b(?:solteir[oa]|casad[oa]|divorciad[oa]|vi[úu]v[oa]|separad[oa]|uni[ãa]o\s+est[áa]vel)\b/gi,
  ],
  // "24 ANOS" é idade. "2 anos 8 meses" é duração de emprego e "5 anos de
  // experiência" é senioridade: daí a faixa de 16 a 99 e a lookahead.
  [
    'idade',
    /(?:idade\s*:?\s*)?\b(?:1[6-9]|[2-9]\d)\s+anos\b(?!\s*(?:\d|e\s+\d|de|em|no|na|meses))/gi,
  ],
];

const overlaps = (a: PiiFinding, b: PiiFinding) =>
  a.index < b.index + b.quote.length && b.index < a.index + a.quote.length;

/** Tudo que parece dado pessoal, em ordem de posição no texto. */
export function findPii(text: string): PiiFinding[] {
  const accepted: PiiFinding[] = [];
  for (const [kind, pattern] of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      const finding = { kind, quote: match[0], index: match.index };
      if (accepted.some((a) => overlaps(a, finding))) continue;
      accepted.push(finding);
    }
  }
  return accepted.sort((a, b) => a.index - b.index);
}

/**
 * Texto sem dados pessoais, mais a lista do que foi tirado.
 *
 * A lista existe para a Fase 2 sinalizar uma vez o que não deveria estar no
 * documento. O texto redigido é o que segue para todo o resto.
 */
export function redact(text: string): { text: string; findings: PiiFinding[] } {
  const findings = findPii(text);
  let out = '';
  let cursor = 0;
  for (const finding of findings) {
    out += text.slice(cursor, finding.index) + LABEL[finding.kind];
    cursor = finding.index + finding.quote.length;
  }
  return { text: out + text.slice(cursor), findings };
}

/** Quantos achados de cada tipo. Serve à sinalização única da Fase 2. */
export function summarizePii(findings: PiiFinding[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of findings) counts[f.kind] = (counts[f.kind] ?? 0) + 1;
  return counts;
}
