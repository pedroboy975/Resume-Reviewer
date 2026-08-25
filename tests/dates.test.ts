import { describe, it, expect } from 'vitest';
import {
  chronological,
  durationMonths,
  findGaps,
  findOverlaps,
  monthsBetween,
  parsePeriods,
  shortTenures,
  totalMonths,
} from '@/lib/dates';
import { sectionText, splitSections } from '@/lib/sections';
import { fixtureNames, fixtureText } from './helpers/fixtures';

const NOW = new Date('2026-08-21');
const only = (text: string) => {
  const periods = parsePeriods(text);
  expect(periods, text).toHaveLength(1);
  return periods[0];
};

describe('parsePeriods', () => {
  it.each([
    ['março de 2020 - outubro de 2023', [2020, 3], [2023, 10]],
    ['08/2013 - 06/2017', [2013, 8], [2017, 6]],
    ['01/10/2015 – 01/10/2016', [2015, 10], [2016, 10]],
    ['Agosto/2013 á Março/2014', [2013, 8], [2014, 3]],
    ['Abril /2014 á Julho/2017', [2014, 4], [2017, 7]],
    ['jan. 2019 até dez. 2020', [2019, 1], [2020, 12]],
    // Currículo em caixa alta perde o acento: sem isto, o período some.
    ['01/07/2017 ATE 01/03/2019', [2017, 7], [2019, 3]],
    ['September 2016 to May 2017', [2016, 9], [2017, 5]],
  ])('lê %s', (text, start, end) => {
    const period = only(text);
    expect([period.start.year, period.start.month]).toEqual(start);
    expect([period.end?.year, period.end?.month]).toEqual(end);
    expect(period.precision).toBe('month');
  });

  it.each(['01/2018 - em andamento', 'junho de 2026 - Present', 'ABRIL 2019 – ATUAL'])(
    'trata %s como em andamento',
    (text) => {
      expect(only(text).end).toBeNull();
    },
  );

  it('guarda o trecho verbatim e a posição', () => {
    const text = 'Empresa X\n01/2016 - 01/2018\nCargo';
    const period = only(text);
    expect(period.quote).toBe('01/2016 - 01/2018');
    expect(text.slice(period.index, period.index + period.quote.length)).toBe(period.quote);
  });

  it('alarga o período quando só o ano foi declarado', () => {
    // "2012 a 2021" pode ser fevereiro a fevereiro. O intervalo mais largo é o
    // que não inventa lacuna onde o documento só foi impreciso.
    const period = only('ArcelorMittal 2012 a 2021');
    expect(period.precision).toBe('year');
    expect(period.start).toEqual({ year: 2012, month: 1 });
    expect(period.end).toEqual({ year: 2021, month: 12 });
  });

  it('não deixa o fim de uma palavra virar mês', () => {
    // "ArcelorMittal 2012" já custou um período engolido na varredura.
    expect(only('ArcelorMittal 2012 a 2021').quote).toBe('2012 a 2021');
  });

  it('não parte 2010/2011 em um token de mês/ano', () => {
    expect(parsePeriods('Ensino Médio 2010/2011 - 2011/2012')).toEqual([]);
  });

  it('descarta período que termina antes de começar', () => {
    expect(parsePeriods('06/2017 - 08/2013')).toEqual([]);
  });

  it('ignora mês fora da faixa e ano absurdo', () => {
    expect(parsePeriods('13/2020 - 14/2021')).toEqual([]);
    expect(parsePeriods('1200 - 1300')).toEqual([]);
  });
});

describe('durationMonths', () => {
  it('conta meses fechados, incluindo o primeiro e o último', () => {
    expect(durationMonths(only('01/2016 - 01/2018'), NOW)).toBe(25);
  });

  it('mede período em andamento até agora', () => {
    expect(durationMonths(only('06/2026 - atual'), NOW)).toBe(3);
  });

  /**
   * O contrato de M1: quando o próprio documento escreve a duração ao lado do
   * período — que é o que o export do LinkedIn faz —, o app tem que dizer o
   * mesmo número. Divergir é contradizer a fonte que está lendo.
   */
  it.each([
    ['02/2024 - 05/2024', 4],
    ['janeiro de 2019 - janeiro de 2021', 25],
    ['03/2021 - 10/2023', 32],
    ['05/2018 - 11/2018', 7],
  ])('concorda com a duração que o documento declara: %s', (text, months) => {
    expect(durationMonths(only(text), NOW)).toBe(months);
  });
});

describe('findGaps', () => {
  it('acha a lacuna entre dois empregos', () => {
    const periods = parsePeriods('A: 01/2015 - 06/2016\nB: 03/2018 - 01/2020');
    expect(findGaps(periods, { now: NOW })).toEqual([
      { from: { year: 2016, month: 6 }, to: { year: 2018, month: 3 }, months: 21 },
    ]);
  });

  it('não chama troca de emprego de lacuna', () => {
    const periods = parsePeriods('A: 01/2015 - 06/2016\nB: 08/2016 - 01/2020');
    expect(findGaps(periods, { now: NOW })).toEqual([]);
  });

  it('ignora sobreposição: dois empregos ao mesmo tempo não abrem buraco', () => {
    const periods = parsePeriods('A: 01/2015 - 01/2020\nB: 01/2016 - 06/2017');
    expect(findGaps(periods, { now: NOW })).toEqual([]);
  });

  it('não abre lacuna depois de um período em andamento', () => {
    const periods = parsePeriods('A: 01/2015 - atual\nB: 01/2016 - 06/2017');
    expect(findGaps(periods, { now: NOW })).toEqual([]);
  });
});

describe('shortTenures', () => {
  it('marca permanência abaixo do limite', () => {
    const periods = parsePeriods('A: 01/2015 - 06/2015\nB: 01/2016 - 01/2020');
    expect(shortTenures(periods, { now: NOW }).map((p) => p.quote)).toEqual(['01/2015 - 06/2015']);
  });

  it('emprego atual nunca é permanência curta: ainda está correndo', () => {
    const periods = parsePeriods('A: 06/2026 - atual');
    expect(shortTenures(periods, { now: NOW })).toEqual([]);
  });
});

describe('monthsBetween', () => {
  it('é negativo quando a ordem se inverte', () => {
    expect(monthsBetween({ year: 2020, month: 6 }, { year: 2019, month: 6 })).toBe(-12);
  });
});

describe.each(fixtureNames)('%s', (file) => {
  it('a experiência declara pelo menos um período', async () => {
    const experiencia = sectionText(splitSections(await fixtureText(file)), 'experiencia');
    expect(parsePeriods(experiencia).length).toBeGreaterThan(0);
  });

  it('todo período tem citação verbatim e duração plausível', async () => {
    const text = await fixtureText(file);
    for (const period of parsePeriods(text)) {
      expect(text.slice(period.index, period.index + period.quote.length)).toBe(period.quote);
      expect(durationMonths(period, NOW)).toBeLessThan(600);
      if (period.end) expect(monthsBetween(period.start, period.end)).toBeGreaterThanOrEqual(0);
    }
  });

  it('lacuna calculada é sempre positiva e dentro da carreira', async () => {
    const experiencia = sectionText(splitSections(await fixtureText(file)), 'experiencia');
    const periods = parsePeriods(experiencia);
    for (const gap of findGaps(periods, { now: NOW })) {
      expect(gap.months).toBeGreaterThanOrEqual(4);
      expect(monthsBetween(gap.from, gap.to)).toBe(gap.months);
    }
  });
});

describe('findOverlaps', () => {
  it('acha o cargo paralelo dentro de outro vínculo', () => {
    const periods = parsePeriods('A: 01/2019 - 01/2021\nB: 06/2020 - 09/2020');
    const [overlap] = findOverlaps(periods, { now: NOW });
    expect(overlap.a.quote).toContain('01/2019');
    expect(overlap.b.quote).toContain('06/2020');
    expect(overlap.months).toBe(4);
  });

  it('não chama troca de emprego de sobreposição', () => {
    const periods = parsePeriods('A: 01/2015 - 06/2016\nB: 06/2016 - 01/2020');
    expect(findOverlaps(periods, { now: NOW })).toEqual([]);
  });

  it('mede sobreposição contra vínculo em andamento', () => {
    const periods = parsePeriods('A: 01/2026 - atual\nB: 03/2026 - 06/2026');
    expect(findOverlaps(periods, { now: NOW })[0].months).toBe(4);
  });

  it('não inventa sobreposição em carreira sequencial', () => {
    const periods = parsePeriods('A: 01/2015 - 06/2016\nB: 03/2018 - 01/2020');
    expect(findOverlaps(periods, { now: NOW })).toEqual([]);
  });
});

describe('chronological', () => {
  it('põe o mais antigo primeiro, contra a ordem do documento', () => {
    // Export do LinkedIn: emprego atual no topo, estágio paralelo no fim.
    const periods = parsePeriods('Atual: 03/2021 - atual\nAntes: 01/2018 - 01/2019');
    expect(chronological(periods).map((p) => p.start.year)).toEqual([2018, 2021]);
  });
});

describe('totalMonths', () => {
  const p = (text: string) => parsePeriods(text);

  it('conta o primeiro e o último mês, como durationMonths', () => {
    expect(totalMonths(p('02/2020 - 05/2020'))).toBe(4);
  });

  it('não conta duas vezes o que se sobrepõe', () => {
    // Dois empregos no mesmo semestre não são doze meses de experiência.
    expect(totalMonths(p('01/2020 - 06/2020\n03/2020 - 06/2020'))).toBe(6);
  });

  it('soma vínculos separados', () => {
    expect(totalMonths(p('01/2018 - 12/2018\n01/2020 - 12/2020'))).toBe(24);
  });

  it('lacuna entre um emprego e o outro não entra', () => {
    expect(totalMonths(p('01/2018 - 12/2018\n01/2022 - 12/2022'))).toBe(24);
  });

  it('período em andamento conta até hoje', () => {
    expect(totalMonths(p('01/2026 - atual'), { now: NOW })).toBe(8);
  });

  it('sem período nenhum, zero', () => {
    expect(totalMonths([])).toBe(0);
  });
});
