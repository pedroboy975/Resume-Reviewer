import { describe, it, expect } from 'vitest';
import { findPii, redact, summarizePii, type PiiKind } from '@/lib/pii';
import { fixtureNames, fixtureText } from './helpers/fixtures';

const kinds = (text: string): PiiKind[] => findPii(text).map((f) => f.kind);

describe('findPii', () => {
  it.each([
    ['(31) 9.9632-1915', 'telefone'],
    ['(+55) 31 9 8637 3511', 'telefone'],
    ['31999199850', 'telefone'],
    ['(31) 99221 - 5844', 'telefone'],
    ['(31) 3356-2366', 'telefone'],
    ['fulano@exemplo.com.br', 'email'],
    ['CPF: 123.456.789-00', 'cpf'],
    ['Carteira de Identidade: MG-16.682.634', 'rg'],
    ['CEP 32315-110', 'cep'],
    ['Data de Nascimento: 12/04/1993', 'nascimento'],
    ['Estado Civil: SOLTEIRO', 'estado-civil'],
    ['Sexo: Masculino', 'sexo'],
    ['BRASILEIRO, 24 ANOS', 'idade'],
    ['Rua dos Jatobás 379 apto 104', 'endereco'],
  ])('acha %s como %s', (text, kind) => {
    expect(kinds(text)).toContain(kind);
  });

  it('acha e-mail quebrado em duas linhas pela barra lateral do LinkedIn', () => {
    // Caso real: a coluna estreita do export de PDF parte o endereço no meio.
    const found = findPii('laura.mattar.notini@gmail.c\nom\nwww.linkedin.com/in/laura');
    expect(found[0].kind).toBe('email');
    expect(found[0].quote).toBe('laura.mattar.notini@gmail.c\nom');
  });

  it('não engole a linha seguinte quando o e-mail está inteiro', () => {
    const found = findPii('pedroboy975@gmail.com\nwww.linkedin.com/in/pedro');
    expect(found[0].quote).toBe('pedroboy975@gmail.com');
  });

  it.each([
    'novembro de 2023 - junho de 2026 (2 anos 8 meses)',
    'Mais de 5 anos de experiência em vendas',
    'Atuação de 10 anos no setor financeiro',
  ])('não confunde duração de carreira com idade: %s', (text) => {
    expect(kinds(text)).not.toContain('idade');
  });

  it('não confunde data com telefone', () => {
    expect(kinds('01/04/2019 – ATUAL')).not.toContain('telefone');
  });

  it('não confunde CEP com telefone', () => {
    expect(kinds('CEP 32315-110')).not.toContain('telefone');
  });

  it('em sobreposição, o padrão mais específico vence', () => {
    // O número do RG casaria pedaços do padrão de telefone se não houvesse ordem.
    expect(kinds('Carteira de Identidade: MG-16.682.634')).toEqual(['rg']);
  });
});

describe('redact', () => {
  it('troca o achado pelo rótulo e devolve a lista', () => {
    const { text, findings } = redact('Contato: fulano@exemplo.com e (31) 99999-1234.');
    expect(text).toBe('Contato: [E-MAIL] e [TELEFONE].');
    expect(findings.map((f) => f.kind)).toEqual(['email', 'telefone']);
  });

  it('preserva o texto que não é dado pessoal', () => {
    const original = 'Gerente de Projetos na ArcelorMittal, 2012 a 2021.';
    expect(redact(original).text).toBe(original);
  });

  it('a citação aponta para o trecho verbatim do original', () => {
    const original = 'E-mail: fulano@exemplo.com';
    for (const f of redact(original).findings) {
      expect(original.slice(f.index, f.index + f.quote.length)).toBe(f.quote);
    }
  });
});

describe('summarizePii', () => {
  it('conta por tipo', () => {
    const { findings } = redact('a@b.com, c@d.com e (31) 99999-1234');
    expect(summarizePii(findings)).toEqual({ email: 2, telefone: 1 });
  });
});

describe.each(fixtureNames)('%s', (file) => {
  it('sai do pré-processamento sem e-mail nem telefone', async () => {
    // Invariante do CLAUDE.md: depois da redação, nenhum módulo posterior vê PII.
    const { text } = redact(await fixtureText(file));
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/);
    expect(text).not.toMatch(/\(\d{2}\)\s*\d?[\s.]?\d{4}[\s.-]*\d{4}/);
  });

  it('acha pelo menos um dado de contato — todo currículo tem', async () => {
    const found = kinds(await fixtureText(file));
    expect(found.some((k) => k === 'email' || k === 'telefone')).toBe(true);
  });
});
