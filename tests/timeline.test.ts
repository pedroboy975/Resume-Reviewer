import { describe, it, expect } from 'vitest';
import { findGaps, parsePeriods } from '@/lib/dates';
import { buildTimeline } from '@/lib/timeline';

const NOW = new Date('2026-08-21');

describe('buildTimeline', () => {
  it('a faixa vai do início mais antigo ao fim mais recente', () => {
    const timeline = buildTimeline(parsePeriods('01/2015 - 01/2018\n01/2019 - 01/2021'), [], {
      now: NOW,
    });
    expect(timeline.from).toEqual({ year: 2015, month: 1 });
    expect(timeline.to).toEqual({ year: 2021, month: 1 });
    expect(timeline.months).toBe(72);
  });

  it('posiciona cada barra dentro da faixa', () => {
    const timeline = buildTimeline(parsePeriods('01/2015 - 01/2018\n01/2019 - 01/2021'), [], {
      now: NOW,
    });
    expect(timeline.bars[0].leftPct).toBe(0);
    expect(timeline.bars[0].widthPct).toBe(50);
    expect(timeline.bars[1].leftPct).toBeCloseTo(66.67, 1);
    expect(timeline.bars[1].widthPct).toBeCloseTo(33.33, 1);
  });

  it('período de um mês ainda aparece', () => {
    // Sem largura mínima a barra some, e some justamente a permanência curta.
    const timeline = buildTimeline(parsePeriods('01/2000 - 01/2020\n01/2010 - 02/2010'), [], {
      now: NOW,
    });
    expect(timeline.bars[1].widthPct).toBeGreaterThanOrEqual(1);
  });

  it('emprego em andamento vai até hoje', () => {
    const timeline = buildTimeline(parsePeriods('01/2015 - atual'), [], { now: NOW });
    expect(timeline.to).toEqual({ year: 2026, month: 8 });
  });

  it('a lacuna cai entre as duas barras', () => {
    const periods = parsePeriods('01/2015 - 01/2018\n01/2019 - 01/2021');
    const timeline = buildTimeline(periods, findGaps(periods, { now: NOW }), { now: NOW });
    expect(timeline.gaps).toHaveLength(1);
    expect(timeline.gaps[0].leftPct).toBe(timeline.bars[0].widthPct);
    expect(timeline.gaps[0].leftPct + timeline.gaps[0].widthPct).toBeCloseTo(
      timeline.bars[1].leftPct,
      6,
    );
  });

  it('ordena do mais antigo para o mais recente, mesmo se o documento inverte', () => {
    // O LinkedIn lista o emprego atual primeiro; ler carreira de baixo para
    // cima não ajuda ninguém.
    const timeline = buildTimeline(parsePeriods('01/2019 - 01/2021\n01/2015 - 01/2018'), [], {
      now: NOW,
    });
    expect(timeline.bars.map((b) => b.period.quote)).toEqual([
      '01/2015 - 01/2018',
      '01/2019 - 01/2021',
    ]);
    expect(timeline.bars[0].leftPct).toBeLessThan(timeline.bars[1].leftPct);
  });

  it('sem período, a linha do tempo é vazia e não quebra', () => {
    const timeline = buildTimeline([], [], { now: NOW });
    expect(timeline.bars).toEqual([]);
    expect(timeline.months).toBe(0);
  });
});
