import { describe, it, expect } from 'vitest';
import { buildDossier, EMPTY_CONTEXT, type DossierInput } from '@/lib/dossier';
import { CAREER_PROMPT } from '@/lib/prompt';
import { findGaps, parsePeriods, shortTenures } from '@/lib/dates';
import { findPii } from '@/lib/pii';
import { assignLines, experienceText, groupAssignedLines } from '@/lib/sections';

const NOW = new Date('2026-08-21');

const input = (over: Partial<DossierInput> = {}): DossierInput => ({
  context: EMPTY_CONTEXT,
  sections: [],
  pii: [],
  periods: [],
  gaps: [],
  shortTenures: [],
  jobs: [],
  now: NOW,
  ...over,
});

/** Um caso completo, montado pelo mesmo caminho que a UI usa. */
function fromText(text: string, over: Partial<DossierInput> = {}) {
  const lines = text.split('\n');
  const sections = groupAssignedLines(lines, assignLines(text));
  const periods = parsePeriods(experienceText(sections));
  return input({
    sections,
    pii: findPii(text),
    periods,
    gaps: findGaps(periods, { now: NOW }),
    shortTenures: shortTenures(periods, { now: NOW }),
    ...over,
  });
}

describe('buildDossier', () => {
  it('leva o prompt de origem inteiro, sem edição', () => {
    expect(buildDossier(input())).toContain(CAREER_PROMPT);
  });

  it('responde de antemão o que a Fase 3 perguntaria', () => {
    const dossier = buildDossier(
      input({
        context: {
          artifact: 'linkedin',
          targetRole: 'Gerente de Produto',
          targetLevel: 'Sênior',
          industry: 'Banco de varejo',
          country: 'Brasil',
          disclosure: 'Não posso publicar receita da carteira',
        },
      }),
    );
    expect(dossier).toContain('**Cargo-alvo:** Gerente de Produto');
    expect(dossier).toContain('**Nível-alvo:** Sênior');
    expect(dossier).toContain('**Setor / tipo de empregador:** Banco de varejo');
    expect(dossier).toContain('**País / mercado:** Brasil');
    expect(dossier).toContain('Não posso publicar receita da carteira');
  });

  it('sem cargo-alvo, manda derivar direções em vez de travar', () => {
    const dossier = buildDossier(input());
    expect(dossier).toContain('Sem cargo-alvo definido');
    expect(dossier).toContain('derive de 2 a 3 direções');
  });

  it('com cargo-alvo, não manda derivar nada', () => {
    const dossier = buildDossier(
      input({ context: { ...EMPTY_CONTEXT, targetRole: 'Analista de Dados' } }),
    );
    expect(dossier).not.toContain('Sem cargo-alvo definido');
  });

  it('campo em branco aparece como não informado, nunca inventado', () => {
    expect(buildDossier(input())).toContain('**Setor / tipo de empregador:** (não informado)');
  });
});

describe('buildDossier · dados pessoais', () => {
  const text = [
    'Fulano de Tal',
    'fulano@exemplo.com | (31) 99999-1234',
    'Rua das Flores, 100',
    'EXPERIÊNCIA',
    'Empresa X — 01/2015 - 01/2018',
  ].join('\n');

  it('nenhum valor de dado pessoal entra no dossiê', () => {
    // Invariante do CLAUDE.md, e este módulo é o último ponto onde poderia vazar.
    const dossier = buildDossier(fromText(text));
    for (const quote of findPii(text).map((f) => f.quote)) {
      expect(dossier, quote).not.toContain(quote);
    }
  });

  it('o tipo é sinalizado uma vez, com a instrução de não repetir', () => {
    const dossier = buildDossier(fromText(text));
    expect(dossier).toContain('Dados pessoais encontrados e removidos:');
    expect(dossier).toContain('e-mail');
    expect(dossier).toContain('telefone');
    expect(dossier).toContain('siga sem mencioná-los de novo');
  });

  it('documento sem dado pessoal diz isso explicitamente', () => {
    expect(buildDossier(fromText('Fulano\nEXPERIÊNCIA\nEmpresa X 01/2015 - 01/2018'))).toContain(
      '**Dados pessoais encontrados:** nenhum',
    );
  });
});

describe('buildDossier · achados determinísticos', () => {
  it('lista os períodos com a duração calculada', () => {
    const dossier = buildDossier(fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 01/2018'));
    expect(dossier).toContain('01/2015 – 01/2018 (3 anos)');
  });

  it('marca o período em que o documento só declarou o ano', () => {
    const dossier = buildDossier(fromText('Nome\nEXPERIÊNCIA\nEmpresa X 2012 a 2021'));
    expect(dossier).toContain('o documento só declarou o ano');
  });

  it('descreve a lacuna encontrada', () => {
    const dossier = buildDossier(
      fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 06/2016\nB: 03/2018 - 01/2020'),
    );
    expect(dossier).toContain('**Lacunas entre empregos:** 06/2016 a 03/2018 (1 ano e 9 meses)');
  });

  it('diz quando não há lacuna, em vez de omitir', () => {
    const dossier = buildDossier(fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 01/2020'));
    expect(dossier).toContain('nenhuma acima de 4 meses');
  });

  it('aponta permanência curta', () => {
    const dossier = buildDossier(
      fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 05/2015\nB: 01/2016 - 01/2020'),
    );
    expect(dossier).toContain('**Permanências abaixo de 12 meses:** 01/2015 – 05/2015');
  });

  it('avisa o modelo para não recalcular', () => {
    expect(buildDossier(input())).toContain('Não recalcule nem contradiga');
  });

  it('mede o resumo contra o limite do campo Sobre', () => {
    const resumo = 'x'.repeat(2700);
    const dossier = buildDossier(
      fromText(`Nome\nRESUMO\n${resumo}`, {
        context: { ...EMPTY_CONTEXT, artifact: 'linkedin' },
      }),
    );
    expect(dossier).toContain('2700 caracteres');
    expect(dossier).toContain('acima do limite');
  });
});

describe('buildDossier · vagas-alvo', () => {
  it('numera as vagas coladas', () => {
    const dossier = buildDossier(input({ jobs: ['Vaga A: liderar squad', 'Vaga B: analisar'] }));
    expect(dossier).toContain('### Vaga 1');
    expect(dossier).toContain('Vaga A: liderar squad');
    expect(dossier).toContain('### Vaga 2');
  });

  it('ignora campo de vaga deixado em branco', () => {
    const dossier = buildDossier(input({ jobs: ['   ', 'Vaga real'] }));
    expect(dossier).toContain('### Vaga 1');
    expect(dossier).not.toContain('### Vaga 2');
  });

  it('sem vaga, manda dizer o que não pôde ser avaliado', () => {
    const dossier = buildDossier(input({ jobs: [] }));
    expect(dossier).toContain('Nenhuma vaga colada');
    expect(dossier).toContain('em vez de inferir');
  });
});

describe('buildDossier · documento', () => {
  it('sai na ordem canônica, não na ordem do PDF', () => {
    const text = 'Nome\nFORMAÇÃO\nFaculdade Y\nRESUMO\nTexto do resumo\nEXPERIÊNCIA\nEmpresa X';
    const dossier = buildDossier(fromText(text));
    expect(dossier.indexOf('### Resumo')).toBeLessThan(dossier.indexOf('### Experiência'));
    expect(dossier.indexOf('### Experiência')).toBeLessThan(dossier.indexOf('### Formação'));
  });

  it('junta seções repetidas do mesmo tipo', () => {
    const text = 'Nome\nEXPERIÊNCIA\nEmpresa A\nFORMAÇÃO\nFaculdade\nEXPERIÊNCIA\nEmpresa B';
    const dossier = buildDossier(fromText(text));
    expect(dossier.match(/### Experiência/g)).toHaveLength(1);
    expect(dossier).toContain('Empresa A');
    expect(dossier).toContain('Empresa B');
  });

  it('não cria seção vazia', () => {
    expect(buildDossier(fromText('Nome\nIDIOMAS\n'))).not.toContain('### Idiomas');
  });
});

describe('buildDossier · seção de contato', () => {
  const text = ['Fulano de Tal', 'CONTATO', 'linkedin.com/in/fulano', 'Belo Horizonte'].join('\n');

  it('não entra no dossiê, nem redigida', () => {
    // Redigir não basta: handle, cidade e perfil não casam com nenhum padrão
    // de pii.ts e sairiam junto. Ver CLAUDE.md > PII.
    const dossier = buildDossier(fromText(text));
    expect(dossier).not.toContain('### Contato');
    expect(dossier).not.toContain('linkedin.com/in/fulano');
  });

  it('o resto do documento continua saindo', () => {
    expect(buildDossier(fromText(text))).toContain('Fulano de Tal');
  });
});

describe('buildDossier · o que o formulário não coletou', () => {
  it('manda perguntar números reais e ambiguidades de histórico', () => {
    const dossier = buildDossier(input());
    expect(dossier).toContain('Ainda não perguntado');
    expect(dossier).toContain('números reais dos');
    expect(dossier).toContain('ambiguidades de histórico');
  });

  it('com uma vaga só, avisa que o vocabulário é de uma empresa', () => {
    const dossier = buildDossier(input({ jobs: ['Vaga única'] }));
    expect(dossier).toContain('Só uma vaga');
  });

  it('com duas vagas, não avisa', () => {
    expect(buildDossier(input({ jobs: ['Vaga A', 'Vaga B'] }))).not.toContain('Só uma vaga');
  });
});

describe('buildDossier · duração por extenso', () => {
  it('concorda em número', () => {
    const dossier = buildDossier(fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 02/2016'));
    expect(dossier).toContain('1 ano e 1 mês');
    expect(dossier).not.toContain('1 meses');
  });
});

describe('buildDossier · tipo de artefato', () => {
  const comResumo = `Nome\nHeadline muito longa\nRESUMO\n${'x'.repeat(2700)}`;

  it.each([
    ['linkedin', 'Perfil do LinkedIn'],
    ['curriculo', 'Currículo'],
    ['ambos', 'Perfil do LinkedIn e currículo'],
  ] as const)('declara %s para a Fase 1', (artifact, label) => {
    const dossier = buildDossier(input({ context: { ...EMPTY_CONTEXT, artifact } }));
    expect(dossier).toContain(`**Tipo de artefato:** ${label}`);
  });

  it('currículo não é medido contra limite de campo do LinkedIn', () => {
    // O limite de 2600 do campo "Sobre" não existe num PDF. Entregá-lo como
    // achado calculado seria inventar restrição.
    const dossier = buildDossier(
      fromText(comResumo, { context: { ...EMPTY_CONTEXT, artifact: 'curriculo' } }),
    );
    expect(dossier).not.toContain('O campo "Sobre" do LinkedIn aceita');
    expect(dossier).not.toContain('o headline do LinkedIn aceita');
  });

  it('perfil do LinkedIn é medido', () => {
    const dossier = buildDossier(
      fromText(comResumo, { context: { ...EMPTY_CONTEXT, artifact: 'linkedin' } }),
    );
    expect(dossier).toContain('O campo "Sobre" do LinkedIn aceita');
    expect(dossier).toContain('o headline do LinkedIn aceita');
  });

  it('com os dois documentos, também mede', () => {
    const dossier = buildDossier(
      fromText(comResumo, { context: { ...EMPTY_CONTEXT, artifact: 'ambos' } }),
    );
    expect(dossier).toContain('O campo "Sobre" do LinkedIn aceita');
  });

  it.each([
    ['linkedin', 'O currículo não foi'],
    ['curriculo', 'O perfil do LinkedIn não foi'],
  ] as const)('com só %s, manda declarar o que não pôde avaliar', (artifact, aviso) => {
    const dossier = buildDossier(input({ context: { ...EMPTY_CONTEXT, artifact } }));
    expect(dossier).toContain('Veio só um documento');
    expect(dossier.replace(/\n> /g, ' ')).toContain(aviso);
  });

  it('com os dois, não avisa de documento ausente', () => {
    const dossier = buildDossier(input({ context: { ...EMPTY_CONTEXT, artifact: 'ambos' } }));
    expect(dossier).not.toContain('Veio só um documento');
  });
});
