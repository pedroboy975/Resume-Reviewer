import { describe, it, expect } from 'vitest';
import { analyze } from '@/lib/analysis';
import { buildDossier, EMPTY_CONTEXT, type DossierInput } from '@/lib/dossier';
import { CAREER_PROMPT } from '@/lib/prompt';
import { findPii } from '@/lib/pii';
import { assignLines } from '@/lib/sections';

const NOW = new Date('2026-08-21');

const input = (over: Partial<DossierInput> = {}): DossierInput => ({
  analysis: analyze('', [], { now: NOW }),
  context: EMPTY_CONTEXT,
  pii: [],
  metrics: [],
  jobs: [],
  now: NOW,
  ...over,
});

/** Um caso completo, montado pelo mesmo caminho que a UI usa. */
function fromText(text: string, over: Partial<DossierInput> = {}) {
  return input({
    analysis: analyze(text, assignLines(text), { now: NOW }),
    pii: findPii(text),
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
    expect(dossier).toContain('01/2015 – 01/2018 (3 anos e 1 mês)');
  });

  it('marca o período em que o documento só declarou o ano', () => {
    const dossier = buildDossier(fromText('Nome\nEXPERIÊNCIA\nEmpresa X 2012 a 2021'));
    expect(dossier).toContain('o documento só declarou o ano');
  });

  /**
   * O contrato de M8: o intervalo entre dois vínculos sai em meses, dentro da
   * sequência. O veredito `Lacunas: nenhuma acima de 4 meses` foi ignorado em
   * todas as rodadas de teste — evidência crua é o que o modelo usa.
   */
  it('emite o intervalo entre vínculos como número, não como veredito', () => {
    const dossier = buildDossier(
      fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 06/2016\nB: 03/2018 - 01/2020'),
    );
    expect(dossier).toContain('21 meses até o começo do próximo');
    expect(dossier).not.toContain('Lacunas entre empregos');
  });

  it('carreira sem intervalo não ganha linha de intervalo nenhuma', () => {
    const dossier = buildDossier(fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 01/2020'));
    expect(dossier).not.toContain('até o começo do próximo');
  });

  it('não classifica permanência como curta: a duração já está na lista', () => {
    const dossier = buildDossier(
      fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 05/2015\nB: 01/2016 - 01/2020'),
    );
    expect(dossier).toContain('01/2015 – 05/2015 (5 meses)');
    expect(dossier).not.toContain('Permanências abaixo de 12 meses');
  });

  it('declara que os achados são dados, não conclusões', () => {
    const dossier = buildDossier(input());
    expect(dossier).toContain('Não recalcule.');
    expect(dossier).toContain('O aplicativo não classifica nada aqui.');
  });

  it('sem termo genérico, diz que o limite é da lista e não do documento', () => {
    expect(buildDossier(input())).toContain('ausência aqui é limite dela, não do documento');
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

describe('buildDossier · respostas da pessoa', () => {
  const comResposta = (answer: string) =>
    input({
      metrics: [
        {
          finding: { quote: 'Reformulei o processo de atendimento da unidade.', label: 'Banco A' },
          answer,
        },
      ],
    });

  it('sai em bloco próprio, fora do documento e fora dos achados', () => {
    const dossier = buildDossier(comResposta('15 clientes por dia'));
    expect(dossier).toContain('## Respostas da pessoa');
    expect(dossier.indexOf('## Respostas da pessoa')).toBeLessThan(
      dossier.indexOf('## Achados determinísticos'),
    );
    expect(dossier.indexOf('## Documento')).toBeLessThan(dossier.indexOf('## Respostas da pessoa'));
  });

  it('diz que não é texto de currículo e manda usar no enquadramento', () => {
    const dossier = buildDossier(comResposta('15 clientes por dia'));
    expect(dossier).toContain('Não fazem parte do documento');
    expect(dossier).toContain('cite-as no enquadramento de nível');
    expect(dossier).toContain('"Reformulei o processo de atendimento da unidade." → 15 clientes');
  });

  it('trecho sem resposta mantém o placeholder e proíbe estimativa', () => {
    const dossier = buildDossier(comResposta(''));
    expect(dossier).toContain('### Ainda sem número (1)');
    expect(dossier).toContain('[FALTA NÚMERO: o que medir]');
    expect(dossier).toContain('Não estime');
  });

  it('o vínculo acompanha a citação, para não confundir empresas', () => {
    expect(buildDossier(comResposta(''))).toContain('**Banco A** — "Reformulei');
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

describe('buildDossier · cabeçalho de estado', () => {
  /** Um caso com tudo o que o gate exige: alvo, vaga, e nada ambíguo. */
  const completo = () =>
    fromText('Nome\nEXPERIÊNCIA\nEmpresa A\nAnalista\n01/2015 - 01/2020', {
      context: { ...EMPTY_CONTEXT, targetRole: 'Gerente de Operações' },
      jobs: ['Vaga colada: liderar operações.'],
    });

  it('vazio, para na Fase 3 e nomeia o que falta', () => {
    const dossier = buildDossier(input());
    expect(dossier).toContain('FASE INICIAL: 3');
    expect(dossier).toContain('O cargo-alvo, que a pessoa ainda não declarou.');
    expect(dossier).toContain('vagas-alvo, que ninguém colou');
  });

  it('completo, manda seguir até a Fase 4 sem parar', () => {
    const dossier = buildDossier(completo());
    expect(dossier).toContain('FASE INICIAL: 4');
    expect(dossier).toContain('Não pare para pedir confirmação.');
  });

  it('não pede o que já foi respondido', () => {
    expect(buildDossier(completo())).not.toContain('O cargo-alvo, que a pessoa');
  });

  it('período sobreposto sozinho já segura na Fase 3', () => {
    const dossier = buildDossier(
      fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 01/2020\nB: 01/2016 - 01/2018', {
        context: { ...EMPTY_CONTEXT, targetRole: 'Gerente de Operações' },
        jobs: ['Vaga colada.'],
      }),
    );
    expect(dossier).toContain('FASE INICIAL: 3');
    expect(dossier).toContain('período sobreposto');
  });

  it('emite a sobreposição como par de datas, sem interpretar', () => {
    const dossier = buildDossier(
      fromText('Nome\nEXPERIÊNCIA\nA: 01/2019 - 01/2021\nB: 06/2020 - 09/2020'),
    );
    expect(dossier).toContain('Períodos que correm ao mesmo tempo (1)');
    expect(dossier).toContain('01/2019 – 01/2021 e 06/2020 – 09/2020');
  });

  it('lista os períodos do mais antigo para o mais recente', () => {
    // Ordem do documento é a do LinkedIn: atual primeiro. Não é a de leitura.
    const dossier = buildDossier(
      fromText('Nome\nEXPERIÊNCIA\nB: 03/2021 - 12/2023\nA: 01/2015 - 01/2018'),
    );
    // No bloco de achados. O `## Documento` acima continua na ordem do PDF,
    // que é o que a pessoa vê no arquivo dela.
    const achados = dossier.slice(dossier.indexOf('Períodos reconhecidos'));
    expect(achados.indexOf('01/2015')).toBeLessThan(achados.indexOf('03/2021'));
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
    const dossier = buildDossier(fromText('Nome\nEXPERIÊNCIA\nA: 01/2015 - 01/2016'));
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

describe('cruzamentos com a vaga', () => {
  const ALVO = 'Gerente de Relacionamento';
  const NA_DIRECAO = 'Vaga: Gerente de Relacionamento Alta Renda em agência digital.';
  const FORA = 'Vaga: Soldador de tubulação industrial com curso NR-13.';

  it('aponta a vaga que não tem nenhum termo do cargo-alvo', () => {
    const d = buildDossier(
      input({ context: { ...EMPTY_CONTEXT, targetRole: ALVO }, jobs: [NA_DIRECAO, FORA] }),
    );
    expect(d).toContain('**Vaga 2 diverge do cargo-alvo declarado.**');
    expect(d).not.toContain('**Vaga 1 diverge');
    // Não reabrir a escolha de direção é o ponto: a pessoa já respondeu.
    expect(d).toContain('não reabra a escolha de');
  });

  it('cala quando nenhuma vaga casa com o alvo', () => {
    // Alvo escrito com outras palavras é mais provável que três colagens
    // erradas — e chamar cada vaga de engano seria pior que ficar calado.
    const d = buildDossier(
      input({ context: { ...EMPTY_CONTEXT, targetRole: ALVO }, jobs: [FORA, FORA] }),
    );
    expect(d).not.toContain('diverge do cargo-alvo');
  });

  it('avisa quando a vaga é de um ex-empregador, com o período', () => {
    const cv = [
      'EXPERIÊNCIA',
      'Banco Exemplo',
      'Analista de Relacionamento',
      'jan/2018 - dez/2020',
      'Atendi a carteira de clientes da agência durante todo o período.',
    ].join('\n');

    const d = buildDossier(
      fromText(cv, { jobs: ['Vaga: Gerente no Banco Exemplo, agência digital.'] }),
    );
    expect(d).toContain('**Vaga 1 menciona empregador do histórico:** Banco Exemplo');
    expect(d).toContain('01/2018 – 12/2020');
  });

  it('não cruza cargo com vaga: a vaga descreve o cargo por definição', () => {
    const cv = [
      'EXPERIÊNCIA',
      'Banco Exemplo',
      'Analista de Relacionamento',
      'jan/2018 - dez/2020',
      'Atendi a carteira de clientes da agência durante todo o período.',
    ].join('\n');

    const d = buildDossier(fromText(cv, { jobs: ['Vaga: Analista de Relacionamento sênior.'] }));
    expect(d).not.toContain('menciona empregador do histórico');
  });
});
