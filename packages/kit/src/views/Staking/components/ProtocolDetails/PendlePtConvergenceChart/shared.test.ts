import { DAY_MS, buildConvergenceModel, findNearestPoint } from './shared';

const now = Date.UTC(2026, 9, 23, 12);
const chart = {
  currentRate: 0.98,
  targetRate: 1,
  remainingDays: 30,
  accountingSymbol: 'USDe',
  ptSymbol: 'PT-sUSDe',
};
const maturityDate = new Date(now + 30 * DAY_MS).toISOString();

function build(
  overrides: Partial<Parameters<typeof buildConvergenceModel>[0]> = {},
) {
  return buildConvergenceModel({ chart, maturityDate, now, ...overrides });
}

describe('Pendle accounting-asset price model', () => {
  it('draws only the forward illustration without inventing history', () => {
    const result = build();
    expect(result?.historical).toEqual([]);
    expect(result?.start).toBe(now);
    expect(result?.forecast[0]).toEqual({
      timestamp: now,
      price: 0.98,
      estimated: false,
    });
    expect(result?.forecast.at(-1)?.price).toBeCloseTo(1, 12);
    expect(result?.forecast.at(-1)?.timestamp).toBe(now + 30 * DAY_MS);
    expect(result?.forecast.slice(1).every((point) => point.estimated)).toBe(
      true,
    );
  });

  it('reconstructs each historical price from its own APY and time to expiry', () => {
    const history = [
      { timestamp: now - 20 * DAY_MS, apy: '10' },
      { timestamp: now - 10 * DAY_MS, apy: '40' },
      { timestamp: now - 5 * DAY_MS, apy: '2' },
    ];
    const result = build({ history });
    expect(result?.historical).toHaveLength(4);
    expect(result?.historical[0].price).toBeCloseTo(1 / 1.1 ** (50 / 365), 12);
    expect(result?.historical[1].price).toBeCloseTo(1 / 1.4 ** (40 / 365), 12);
    expect(result?.historical[1].price).toBeLessThan(
      result?.historical[0].price ?? 0,
    );
    expect(result?.historical[2].price).toBeGreaterThan(
      result?.historical[1].price ?? 0,
    );
    expect(result?.min).toBeLessThan(result?.historical[1].price ?? 0);
  });

  it('caps the comparable past window at 60 days and sorts/deduplicates samples', () => {
    const result = build({
      chart: { ...chart, remainingDays: 120 },
      maturityDate: new Date(now + 120 * DAY_MS).toISOString(),
      history: [
        { timestamp: now - DAY_MS, apy: '5' },
        { timestamp: now - 61 * DAY_MS, apy: '5' },
        { timestamp: now - 60 * DAY_MS, apy: '5' },
        { timestamp: now - DAY_MS, apy: '6' },
        { timestamp: now + DAY_MS, apy: '7' },
      ],
    });
    expect(result?.start).toBe(now - 60 * DAY_MS);
    expect(result?.historical).toHaveLength(3);
    expect(result?.historical[1].price).toBeCloseTo(
      1 / 1.06 ** (121 / 365),
      12,
    );
  });

  it('does not reconstruct price history from remaining days or a single sample', () => {
    const history = [
      { timestamp: now - 2 * DAY_MS, apy: '5' },
      { timestamp: now - DAY_MS, apy: '6' },
    ];
    expect(build({ history, maturityDate: undefined })?.historical).toEqual([]);
    expect(build({ history: history.slice(0, 1) })?.historical).toEqual([]);
  });

  it('parses the server calendar-date format explicitly', () => {
    expect(build({ maturityDate: '26 Nov 2026' })?.maturity).toBe(
      new Date(2026, 10, 26).getTime(),
    );
    expect(build({ maturityDate: 'invalid date' })?.historical).toEqual([]);
  });

  it('does not postpone a remaining-days expiry when the clock advances', () => {
    const result = build({
      maturityDate: undefined,
      asOf: now,
      now: now + 31 * DAY_MS,
    });
    expect(result?.maturity).toBe(now + 30 * DAY_MS);
    expect(result?.isMatured).toBe(true);
    expect(result?.forecast).toEqual([]);
  });

  it('rejects unusable observations without turning missing APY into zero', () => {
    const result = build({
      history: [
        { timestamp: now - 2 * DAY_MS, apy: '' },
        { timestamp: now - DAY_MS, apy: '-100' },
        { timestamp: NaN, apy: '5' },
        { timestamp: now - DAY_MS, apy: 'Infinity' },
      ],
    });
    expect(result?.historical).toEqual([]);
    expect(build({ chart: { ...chart, currentRate: NaN } })).toBeUndefined();
    expect(build({ chart: { ...chart, targetRate: 0 } })).toBeUndefined();
    expect(
      build({ chart: { ...chart, accountingSymbol: '' } }),
    ).toBeUndefined();
  });

  it('handles par, premium and matured assets without a fake growing curve', () => {
    expect(
      build({ chart: { ...chart, currentRate: 1 } })?.forecast.every(
        (point) => point.price === 1,
      ),
    ).toBe(true);
    const premium = build({ chart: { ...chart, currentRate: 1.02 } });
    expect(premium?.forecast[1].price).toBeLessThan(1.02);
    const matured = build({
      maturityDate: new Date(now - DAY_MS).toISOString(),
    });
    expect(matured?.forecast).toEqual([]);
    expect(matured?.current.price).toBe(1);
    expect(matured?.isMatured).toBe(true);
  });

  it('selects by time distance, including both endpoints', () => {
    const result = build();
    expect(result).toBeDefined();
    if (!result) return;
    expect(findNearestPoint(result.points, now - DAY_MS)).toBe(
      result.points[0],
    );
    expect(findNearestPoint(result.points, now + 60 * DAY_MS)).toBe(
      result.points.at(-1),
    );
    expect(
      findNearestPoint(result.points, result.points[8].timestamp + 1),
    ).toBe(result.points[8]);
  });
});
