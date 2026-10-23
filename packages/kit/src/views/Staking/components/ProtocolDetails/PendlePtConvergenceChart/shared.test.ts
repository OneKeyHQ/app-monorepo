import {
  DAY_MS,
  buildPtPriceChart,
  findNearestPoint,
  formatRate,
  getMaturityTimestamp,
  getPtPriceAtTime,
} from './shared';

import type { IPendlePtConvergenceChartProps } from './shared';

const now = Date.UTC(2026, 9, 23);
const chart: IPendlePtConvergenceChartProps['chart'] = {
  currentRate: 0.98,
  targetRate: 1,
  remainingDays: 30,
  accountingSymbol: 'USDe',
  ptSymbol: 'PT-sUSDe',
};
const maturity = {
  date: new Date(now + 30 * DAY_MS).toISOString(),
  daysRemaining: '30',
  isMatured: false,
};
const point = (daysAgo: number, impliedApy: string) => ({
  timestamp: now - daysAgo * DAY_MS,
  impliedApy,
  underlyingApy: '8',
});

describe('Pendle PT price chart', () => {
  it('uses recorded implied APY in percent and the historical time to expiry', () => {
    const model = buildPtPriceChart({
      chart,
      maturity,
      now,
      history: [point(15, '12')],
    });
    expect(model?.historical[0].price).toBeCloseTo(1 / 1.12 ** (45 / 365), 12);
    expect(model?.projection[0].price).toBe(chart.currentRate);
    expect(model?.projection.at(-1)?.price).toBeCloseTo(1, 12);
    expect(model?.projection.at(-1)?.timestamp).toBe(now + 30 * DAY_MS);
    expect(
      model?.projection.slice(1).every((p) => p.source === 'estimate'),
    ).toBe(true);
  });

  it('keeps real historical volatility, sorted and deduplicated, including above-par observations', () => {
    const history = [
      point(5, '20'),
      point(20, '2'),
      point(10, '-5'),
      point(5, '30'),
    ];
    const model = buildPtPriceChart({ chart, maturity, now, history });
    expect(model?.historical).toHaveLength(3);
    expect(model?.historical.map((p) => p.timestamp)).toEqual(
      [20, 10, 5].map((d) => now - d * DAY_MS),
    );
    expect(model?.historical[1].price).toBeGreaterThan(1);
    expect(model?.maxPrice).toBeGreaterThan(model?.historical[1].price ?? 0);
    expect(model?.historical[2].price).toBeCloseTo(1 / 1.3 ** (35 / 365), 12);
  });

  it('limits the past to the remaining duration, capped at 60 days', () => {
    const history = [point(61, '10'), point(40, '10'), point(20, '10')];
    const short = buildPtPriceChart({ chart, maturity, now, history });
    expect(short?.historical).toHaveLength(1);
    const long = buildPtPriceChart({
      chart,
      maturity: {
        ...maturity,
        date: new Date(now + 120 * DAY_MS).toISOString(),
      },
      now,
      history,
    });
    expect(long?.historical).toHaveLength(2);
  });

  it('uses all width for a forward-only illustration when history or expiry is unavailable', () => {
    const model = buildPtPriceChart({ chart, now, history: [point(5, '10')] });
    expect(model?.historical).toEqual([]);
    expect(model?.start).toBe(now);
    expect(model?.end).toBe(now + 30 * DAY_MS);
    const empty = buildPtPriceChart({ chart, maturity, now, history: [] });
    expect(empty?.start).toBe(now);
  });

  it('drops invalid, future and out-of-window observations without inventing replacements', () => {
    const history = [
      point(5, ''),
      point(10, 'NaN'),
      point(15, '-100'),
      point(-1, '10'),
      point(31, '10'),
      { ...point(3, '10'), timestamp: NaN },
    ];
    expect(
      buildPtPriceChart({ chart, maturity, now, history })?.historical,
    ).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid price %s', (currentRate) => {
    expect(
      buildPtPriceChart({ chart: { ...chart, currentRate }, maturity, now }),
    ).toBeUndefined();
  });

  it('does not project a matured market, and supports equal or above-par current prices', () => {
    expect(
      buildPtPriceChart({
        chart,
        maturity: { ...maturity, isMatured: true },
        now,
      }),
    ).toBeUndefined();
    expect(
      buildPtPriceChart({
        chart,
        maturity: { ...maturity, date: new Date(now).toISOString() },
        now,
      }),
    ).toBeUndefined();
    for (const currentRate of [1, 1.01]) {
      const model = buildPtPriceChart({
        chart: { ...chart, currentRate },
        maturity,
        now,
      });
      expect(model?.projection.every((p) => Number.isFinite(p.price))).toBe(
        true,
      );
      expect(model?.projection.at(-1)?.price).toBeCloseTo(1, 12);
      expect(model?.maxPrice).toBeGreaterThan(model?.minPrice ?? Infinity);
    }
  });

  it('reads calendar expiry dates in UTC and finds the nearest recorded observation', () => {
    expect(getMaturityTimestamp('22 Nov 2026')).toBe(Date.UTC(2026, 10, 22));
    expect(getMaturityTimestamp('2026-11-22')).toBe(Date.UTC(2026, 10, 22));
    expect(getMaturityTimestamp('31 Nov 2026')).toBeUndefined();
    expect(getMaturityTimestamp('2026-11-31T00:00:00Z')).toBeUndefined();
    expect(getMaturityTimestamp('bad')).toBeUndefined();
    const model = buildPtPriceChart({
      chart,
      maturity,
      now,
      history: [point(5, '10'), point(10, '12')],
    });
    expect(
      findNearestPoint(model?.historical ?? [], now - 6 * DAY_MS)?.timestamp,
    ).toBe(now - 5 * DAY_MS);
  });

  it('inspects continuous future estimates and reuses recorded prices in the past', () => {
    const model = buildPtPriceChart({
      chart,
      maturity,
      now,
      history: [point(5, '10')],
    });
    expect(model).toBeDefined();
    if (!model) return;
    const halfway = getPtPriceAtTime(model, now + 15 * DAY_MS);
    expect(halfway?.source).toBe('estimate');
    expect(halfway?.price).toBeCloseTo(Math.sqrt(0.98), 12);
    expect(getPtPriceAtTime(model, now - 4 * DAY_MS)?.timestamp).toBe(
      now - 5 * DAY_MS,
    );
    expect(getPtPriceAtTime(model, now - 40 * DAY_MS)).toBeUndefined();
    expect(getPtPriceAtTime(model, model.end)?.price).toBe(1);
  });

  it('rejects overflowing date inputs and keeps small valid prices readable', () => {
    expect(
      buildPtPriceChart({ chart: { ...chart, remainingDays: 1e308 }, now }),
    ).toBeUndefined();
    expect(formatRate(0.0000001)).not.toBe('0');
    expect(formatRate(NaN)).toBe('--');
  });
});
