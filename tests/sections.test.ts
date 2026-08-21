import { describe, it, expect } from 'vitest';
import {
  assignLines,
  groupAssignedLines,
  sectionText,
  splitSections,
  type SectionKind,
} from '@/lib/sections';
import { fixtureNames, fixtureText } from './helpers/fixtures';

const kindsOf = (text: string): SectionKind[] => splitSections(text).map((s) => s.kind);

describe('splitSections', () => {
  it('o que vem antes do primeiro título é cabeçalho', () => {
    const sections = splitSections('Fulano de Tal\nGerente\n\nEXPERIÊNCIA\nEmpresa X');
    expect(sections[0].kind).toBe('header');
    expect(sections[0].heading).toBeNull();
    expect(sections[0].text).toBe('Fulano de Tal\nGerente');
  });

  it.each([
    ['SÍNTESE PROFISSIONAL', 'resumo'],
    ['OBJETIVOS', 'resumo'],
    ['Resumo', 'resumo'],
    ['EXPERIÊNCIAS PROFISSIONAIS', 'experiencia'],
    ['Experiência', 'experiencia'],
    ['ESCOLARIDADE:', 'formacao'],
    ['Formação acadêmica', 'formacao'],
    ['HABILIDADES', 'competencias'],
    ['Principais competências', 'competencias'],
    ['Languages', 'idiomas'],
    ['CERTIFICADOS', 'certificacoes'],
    ['Contato', 'contato'],
  ])('reconhece %s como %s', (heading, kind) => {
    expect(kindsOf(`Nome\n${heading}\nconteúdo`)).toEqual(['header', kind]);
  });

  it('o primeiro termo do título desempata', () => {
    // "FORMAÇÃO ACADÊMICA | IDIOMAS" é formação, não idiomas.
    expect(kindsOf('Nome\nFORMAÇÃO ACADÊMICA | IDIOMAS\nconteúdo')).toEqual(['header', 'formacao']);
  });

  it('frase corrida não é título, mesmo começando com a palavra certa', () => {
    // Caso real: um currículo abre o resumo com esta linha.
    const line = 'Experiência em otimizar resultados a partir do desenvolvimento de projetos';
    expect(kindsOf(`Nome\n${line}`)).toEqual(['header']);
  });

  it('linha terminada em ponto não é título', () => {
    expect(kindsOf('Nome\ncursos disponíveis.\nconteúdo')).toEqual(['header']);
  });

  it('o recorte aponta para o texto original', () => {
    const text = 'Nome\nEXPERIÊNCIA\nEmpresa X\nFORMAÇÃO\nFaculdade Y';
    for (const section of splitSections(text)) {
      if (section.heading) expect(text.slice(section.start)).toMatch(new RegExp(`^${section.heading}`));
      expect(text.slice(section.start, section.end)).toContain(section.text);
    }
  });

  it('seção vazia continua existindo — seção no estado default é um achado', () => {
    const sections = splitSections('Nome\nEXPERIÊNCIA\n\nFORMAÇÃO\nFaculdade Y');
    expect(sections.find((s) => s.kind === 'experiencia')?.text).toBe('');
  });
});

describe('sectionText', () => {
  it('junta repetições do mesmo título', () => {
    // O LinkedIn reabre "Experiência" a cada quebra de página.
    const sections = splitSections('Nome\nExperiência\nEmpresa A\nExperiência\nEmpresa B');
    expect(sectionText(sections, 'experiencia')).toBe('Empresa A\nEmpresa B');
  });

  it('devolve string vazia quando a seção não existe', () => {
    expect(sectionText(splitSections('Nome\nEXPERIÊNCIA\nX'), 'idiomas')).toBe('');
  });
});

describe.each(fixtureNames)('%s', (file) => {
  it('tem seção de experiência com conteúdo', async () => {
    const sections = splitSections(await fixtureText(file));
    expect(sectionText(sections, 'experiencia').length).toBeGreaterThan(200);
  });

  it('tem formação', async () => {
    expect(sectionText(splitSections(await fixtureText(file)), 'formacao')).not.toBe('');
  });

  it('não fatia o documento em pedacinhos', async () => {
    // Título demais é sinal de heurística frouxa pegando texto corrido.
    const sections = splitSections(await fixtureText(file));
    expect(sections.length).toBeLessThanOrEqual(12);
  });
});

describe('assignLines', () => {
  it('dá uma seção para cada linha, título incluído', () => {
    const text = 'Fulano\nEXPERIÊNCIA\nEmpresa X\nFORMAÇÃO\nFaculdade Y';
    expect(assignLines(text)).toEqual([
      'header',
      'experiencia',
      'experiencia',
      'formacao',
      'formacao',
    ]);
  });

  it('linha em branco herda a seção corrente', () => {
    expect(assignLines('Nome\nEXPERIÊNCIA\n\nEmpresa X')).toEqual([
      'header',
      'experiencia',
      'experiencia',
      'experiencia',
    ]);
  });

  it('concorda com splitSections sobre onde cada seção começa', async () => {
    for (const file of fixtureNames) {
      const text = await fixtureText(file);
      const assignment = assignLines(text);
      for (const section of splitSections(text)) {
        if (!section.heading) continue;
        // Índice da linha em que a seção abre = quantas quebras vêm antes dela.
        const line = text.slice(0, section.start).split('\n').length - 1;
        expect(assignment[line], `${file}: ${section.heading}`).toBe(section.kind);
      }
    }
  });
});

describe('groupAssignedLines', () => {
  it('junta linhas consecutivas da mesma seção', () => {
    const lines = ['Nome', 'EXPERIÊNCIA', 'Empresa X'];
    expect(groupAssignedLines(lines, ['header', 'experiencia', 'experiencia'])).toEqual([
      { kind: 'header', from: 0, to: 0, text: 'Nome' },
      { kind: 'experiencia', from: 1, to: 2, text: 'EXPERIÊNCIA\nEmpresa X' },
    ]);
  });

  it('reatribuir uma linha do meio parte o bloco em três', () => {
    // É o que a UI de correção faz quando o usuário move um trecho de seção.
    const lines = ['a', 'b', 'c'];
    const groups = groupAssignedLines(lines, ['experiencia', 'formacao', 'experiencia']);
    expect(groups.map((g) => [g.kind, g.text])).toEqual([
      ['experiencia', 'a'],
      ['formacao', 'b'],
      ['experiencia', 'c'],
    ]);
  });

  it('preserva todas as linhas', () => {
    const lines = ['a', 'b', 'c', 'd'];
    const groups = groupAssignedLines(lines, ['header', 'header', 'resumo', 'resumo']);
    expect(groups.map((g) => g.text).join('\n').split('\n')).toEqual(lines);
  });
});
