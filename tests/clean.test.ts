/**
 * O caso que motivou o módulo é o do dossiê real: o rodapé da página costurado
 * dentro da citação, e a frase truncada na quebra de página.
 */

import { describe, expect, it } from 'vitest';
import { cleanText, isLocation, isPageFurniture } from '@/lib/clean';
import { documentToText, type Page } from '@/lib/layout';
import { findMissingMetrics, paragraphs } from '@/lib/metrics';

describe('rodapé de paginação', () => {
  it('reconhece as formas de rodapé, em português e inglês', () => {
    expect(isPageFurniture('Page 2 of 5')).toBe(true);
    expect(isPageFurniture('  página 3 de 10  ')).toBe(true);
    expect(isPageFurniture('Pag 1 de 2')).toBe(true);
  });

  it('não descarta linha que só parece paginação', () => {
    expect(isPageFurniture('2/5')).toBe(false);
    expect(isPageFurniture('Page one of many decisions')).toBe(false);
    expect(isPageFurniture('Gerenciei 3 de 5 unidades')).toBe(false);
  });

  it('sai do texto antes de entrar na citação', () => {
    const text = ['Fui responsável pela transição do atendimento', 'Page 2 of 5'].join('\n');
    expect(cleanText(text)).toBe('Fui responsável pela transição do atendimento');
  });
});

describe('sentença colada no ponto', () => {
  it('devolve o espaço que o extrator comeu', () => {
    expect(cleanText('Atuo lá até hoje.Gerencio a carteira.')).toBe(
      'Atuo lá até hoje. Gerencio a carteira.',
    );
    expect(cleanText('Customer Experience (CX).Destaques do período')).toBe(
      'Customer Experience (CX). Destaques do período',
    );
  });

  it('não separa inicial de nome nem sigla pontuada', () => {
    expect(cleanText('Reportava a J.Silva')).toBe('Reportava a J.Silva');
  });
});

describe('localidade colada no bullet', () => {
  it('separa o metadado do texto do vínculo', () => {
    const glued = 'Belo Horizonte, Minas Gerais, Brasil Responsável pela gestão de caixa diária';
    expect(cleanText(glued)).toBe(
      'Belo Horizonte, Minas Gerais, Brasil\nResponsável pela gestão de caixa diária',
    );
  });

  it('não quebra frase que só tem vírgula', () => {
    const prose = 'Atendimento, prospecção e retenção Foram os pilares do trabalho executado';
    expect(cleanText(prose)).toBe(prose);
  });
});

describe('linha de localidade', () => {
  it.each([
    'Belo Horizonte, Minas Gerais, Brasil',
    'Contagem, Minas Gerais',
    // Campo de local do LinkedIn no idioma do perfil. Continua sendo local.
    'Белу-Оризонти, MG',
  ])('reconhece %s', (line) => {
    expect(isLocation(line)).toBe(true);
  });

  it.each([
    'Atendimento, prospecção e retenção',
    'Gerenciei equipes de compras, estoque e contratos',
    'Analista Sênior, Tesouraria, com foco em hedge cambial e derivativos',
  ])('não confunde %s com localidade', (line) => {
    expect(isLocation(line)).toBe(false);
  });

  it('não é costurada na responsabilidade que vem abaixo dela', () => {
    const experiencia = [
      'Kinross Gold Corporation',
      'Analista Sênior de Tesouraria',
      'novembro de 2023 - junho de 2026',
      'Belo Horizonte, Minas Gerais, Brasil',
      'Responsável pela gestão de caixa e relacionamento bancário para Brasil e Chile.',
    ].join('\n');

    expect(findMissingMetrics(experiencia).map((m) => m.quote)).toEqual([
      'Responsável pela gestão de caixa e relacionamento bancário para Brasil e Chile.',
    ]);
  });
});

/** Uma página vira uma `Page` com um item por linha, empilhados de cima para baixo. */
const pageOf = (lines: string[]): Page => ({
  width: 600,
  height: 800,
  items: lines.map((str, i) => ({ str, x: 50, y: 700 - i * 20, width: 400, height: 12 })),
});

describe('frase que atravessa a quebra de página', () => {
  const pages = [
    pageOf(['Fui responsável pela transição do atendimento transacional para um', 'Page 2 of 5']),
    pageOf(['modelo focado em consultoria e identificação de oportunidades.']),
  ];

  it('costura os dois pedaços num parágrafo só, sem o rodapé', () => {
    const paras = paragraphs(documentToText(pages));
    expect(paras).toHaveLength(1);
    expect(paras[0].text).toBe(
      'Fui responsável pela transição do atendimento transacional para um modelo focado em consultoria e identificação de oportunidades.',
    );
  });

  it('mantém a linha em branco quando a página fecha a frase', () => {
    const closed = [pageOf(['Gerenciei a carteira de clientes.']), pageOf(['Formação acadêmica'])];
    expect(documentToText(closed)).toBe('Gerenciei a carteira de clientes.\n\nFormação acadêmica');
  });
});

describe('frase sem número dentro de parágrafo que tem número', () => {
  it('é cobrada por frase, não pelo bloco inteiro', () => {
    const experiencia = [
      'Banco Exemplo',
      'Especialista de Atendimento',
      'janeiro de 2019 - janeiro de 2021',
      'Reformulei o processo de atendimento consultivo da unidade inteira.',
      'Atendi 15 clientes por dia com foco em retenção e satisfação.',
    ].join('\n');

    const quotes = findMissingMetrics(experiencia).map((m) => m.quote);
    expect(quotes).toEqual([
      'Reformulei o processo de atendimento consultivo da unidade inteira.',
    ]);
  });
});

describe('marcador em fonte de símbolo', () => {
  it('some do texto em vez de grudar no nome da empresa', () => {
    // U+F0E8: marcador Wingdings de um dos currículos reais. Não é espaço para
    // `trim()` nem marcador para `paragraphs` — sobrava colado na frente.
    expect(cleanText(' Restaurante Hokkaido').trim()).toBe('Restaurante Hokkaido');
  });
});
