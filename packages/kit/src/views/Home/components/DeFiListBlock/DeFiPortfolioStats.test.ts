import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import {
  PORTFOLIO_OTHERS_TOKEN,
  PORTFOLIO_PALETTE_TOKENS,
} from './DeFiPortfolioPalette';
import {
  PORTFOLIO_TOP_N,
  buildPortfolioSliceLookup,
  buildPortfolioStats,
  distributePercents,
} from './DeFiPortfolioStats';

function makeProtocol(protocol: string, networkId = 'evm--1'): IDeFiProtocol {
  return {
    protocol,
    networkId,
  } as IDeFiProtocol;
}

function makeMap(
  entries: Array<{ protocol: string; name?: string; networkId?: string }>,
): Record<string, IProtocolSummary> {
  const map: Record<string, IProtocolSummary> = {};
  entries.forEach(({ protocol, name, networkId = 'evm--1' }) => {
    const key = defiUtils.buildProtocolMapKey({ protocol, networkId });
    map[key] = {
      protocolName: name ?? protocol,
      protocolLogo: '',
    } as IProtocolSummary;
  });
  return map;
}

describe('distributePercents (largest-remainder method)', () => {
  it('returns zeros when total is zero', () => {
    expect(distributePercents([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('returns 100 for a single non-zero value', () => {
    expect(distributePercents([42])).toEqual([100]);
  });

  it('returns clean integers for even splits with no remainder', () => {
    expect(distributePercents([1, 1, 1, 1])).toEqual([25, 25, 25, 25]);
  });

  it('distributes the residue to the largest fractional remainder', () => {
    // [1, 1, 1] -> raws (in tenths) = 333.33 each; floors = 333 each;
    // remainder = 1; ties broken by input order via stable sort.
    expect(distributePercents([1, 1, 1])).toEqual([33.4, 33.3, 33.3]);
  });

  it('always sums to exactly 100 within float precision', () => {
    const cases = [
      [10, 20, 30, 40],
      [1, 2, 3, 4, 5, 6, 7],
      [0.1, 0.2, 0.3],
      [99, 1],
      [16.666_666, 16.666_666, 16.666_666, 16.666_666, 16.666_666, 16.666_666],
    ];
    for (const c of cases) {
      const out = distributePercents(c);
      const sum = out.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(100, 10);
    }
  });

  it('returns zeros for negative or non-finite totals', () => {
    expect(distributePercents([Number.NaN, 1])).toEqual([0, 0]);
  });
});

describe('buildPortfolioStats', () => {
  it('returns empty stats when protocols is undefined', () => {
    const stats = buildPortfolioStats({
      protocols: undefined,
      protocolMap: {},
      getNetWorth: () => 0,
    });
    expect(stats).toEqual({ total: 0, slices: [] });
  });

  it('returns empty stats when protocols is empty', () => {
    const stats = buildPortfolioStats({
      protocols: [],
      protocolMap: {},
      getNetWorth: () => 0,
    });
    expect(stats).toEqual({ total: 0, slices: [] });
  });

  it('returns a single slice for one protocol', () => {
    const p = makeProtocol('pendle');
    const stats = buildPortfolioStats({
      protocols: [p],
      protocolMap: makeMap([{ protocol: 'pendle', name: 'Pendle' }]),
      getNetWorth: () => 100,
    });
    expect(stats.total).toBe(100);
    expect(stats.slices).toHaveLength(1);
    expect(stats.slices[0]).toMatchObject({
      label: 'Pendle',
      netWorth: 100,
      percent: 100,
      colorToken: PORTFOLIO_PALETTE_TOKENS[0],
      networkIds: ['evm--1'],
    });
  });

  it('aggregates the same protocol across networks', () => {
    const aaveEth = makeProtocol('aave', 'evm--1');
    const aaveArb = makeProtocol('aave', 'evm--42161');
    const pendle = makeProtocol('pendle');
    const stats = buildPortfolioStats({
      protocols: [aaveEth, aaveArb, pendle],
      protocolMap: makeMap([
        { protocol: 'aave', networkId: 'evm--1', name: 'Aave V3' },
        { protocol: 'aave', networkId: 'evm--42161', name: 'Aave V3' },
        { protocol: 'pendle', name: 'Pendle' },
      ]),
      getNetWorth: (p) => {
        if (p.protocol === 'aave' && p.networkId === 'evm--1') return 50;
        if (p.protocol === 'aave' && p.networkId === 'evm--42161') return 30;
        return 20;
      },
    });
    expect(stats.total).toBe(100);
    expect(stats.slices).toHaveLength(2);
    expect(stats.slices[0]).toMatchObject({
      key: 'aave',
      label: 'Aave V3',
      netWorth: 80,
      colorToken: PORTFOLIO_PALETTE_TOKENS[0],
      networkIds: ['evm--1', 'evm--42161'],
    });
    expect(stats.slices[1]).toMatchObject({
      key: 'pendle',
      label: 'Pendle',
      netWorth: 20,
      colorToken: PORTFOLIO_PALETTE_TOKENS[1],
      networkIds: ['evm--1'],
    });
  });

  it('returns 5 slices and no Others when given exactly TOP_N protocols above the floor', () => {
    const protocols = Array.from({ length: PORTFOLIO_TOP_N }, (_, i) =>
      makeProtocol(`p${i}`),
    );
    // All values above the 3% floor (4% is the smallest, qualifies).
    const values = [50, 30, 10, 6, 4];
    const getNetWorth = (p: IDeFiProtocol) =>
      values[Number(p.protocol.slice(1))];
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth,
    });
    expect(stats.total).toBe(100);
    expect(stats.slices).toHaveLength(PORTFOLIO_TOP_N);
    expect(stats.slices.every((s) => s.key !== 'others')).toBe(true);
    expect(stats.slices.map((s) => s.percent)).toEqual([50, 30, 10, 6, 4]);
    stats.slices.forEach((s, i) => {
      expect(s.colorToken).toBe(PORTFOLIO_PALETTE_TOKENS[i]);
    });
  });

  it('aggregates protocols beyond TOP_N into an Others slice', () => {
    const protocols = Array.from({ length: PORTFOLIO_TOP_N + 3 }, (_, i) =>
      makeProtocol(`p${i}`),
    );
    // All Top-5 values above the 3% floor; the tail [3, 2, 1] aggregates.
    const values = [50, 20, 10, 8, 6, 3, 2, 1];
    const getNetWorth = (p: IDeFiProtocol) =>
      values[Number(p.protocol.slice(1))];
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth,
    });
    expect(stats.total).toBe(100);
    expect(stats.slices).toHaveLength(PORTFOLIO_TOP_N + 1);
    const others = stats.slices[stats.slices.length - 1];
    expect(others.key).toBe('others');
    expect(others.netWorth).toBe(3 + 2 + 1);
    expect(others.percent).toBe(6);
    expect(others.colorToken).toBe(PORTFOLIO_OTHERS_TOKEN);
  });

  it('demotes Top-N candidates below the 3% floor to Others', () => {
    // Top-4 qualify (50, 25, 10, 9); the remaining 2%-each entries
    // are all below the 3% floor and demote to Others (6%) even
    // though they would otherwise occupy the 5th Top-N slot.
    const protocols = Array.from({ length: 7 }, (_, i) =>
      makeProtocol(`p${i}`),
    );
    const values = [50, 25, 10, 9, 2, 2, 2]; // sum = 100
    const getNetWorth = (p: IDeFiProtocol) =>
      values[Number(p.protocol.slice(1))];
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth,
    });
    expect(stats.slices).toHaveLength(5); // 4 head + Others
    expect(stats.slices.slice(0, 4).map((s) => s.percent)).toEqual([
      50, 25, 10, 9,
    ]);
    const others = stats.slices[stats.slices.length - 1];
    expect(others.key).toBe('others');
    expect(others.netWorth).toBe(2 + 2 + 2);
    expect(others.percent).toBe(6);
  });

  it('drops the Others slice when tail sum is zero', () => {
    const protocols = Array.from({ length: PORTFOLIO_TOP_N + 2 }, (_, i) =>
      makeProtocol(`p${i}`),
    );
    const values = [50, 20, 10, 10, 10, 0, 0];
    const getNetWorth = (p: IDeFiProtocol) =>
      values[Number(p.protocol.slice(1))];
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth,
    });
    expect(stats.slices).toHaveLength(PORTFOLIO_TOP_N);
    expect(stats.slices.every((s) => s.key !== 'others')).toBe(true);
  });

  it('returns no slices when total exposure is zero (renders empty strip upstream)', () => {
    const protocols = [makeProtocol('a'), makeProtocol('b')];
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap([
        { protocol: 'a', name: 'A' },
        { protocol: 'b', name: 'B' },
      ]),
      getNetWorth: () => 0,
    });
    expect(stats.total).toBe(0);
    expect(stats.slices).toHaveLength(0);
  });

  it('distributes residues so percents sum to exactly 100', () => {
    // Six equal exposures => 16.666...% each. Without largest-remainder
    // the rounded labels show 100.2%; this test pins the invariant.
    const protocols = Array.from({ length: 6 }, (_, i) =>
      makeProtocol(`p${i}`),
    );
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth: () => 1,
    });
    // PORTFOLIO_TOP_N = 5, so 5 head + Others.
    expect(stats.slices).toHaveLength(PORTFOLIO_TOP_N + 1);
    const sum = stats.slices.reduce((acc, s) => acc + s.percent, 0);
    expect(sum).toBeCloseTo(100, 10);
  });

  it('keeps a single decimal of precision for displayed percents', () => {
    const protocols = Array.from({ length: 3 }, (_, i) =>
      makeProtocol(`p${i}`),
    );
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth: () => 1,
    });
    stats.slices.forEach((s) => {
      // toFixed(1) round-trip must match (no second-decimal junk).
      expect(s.percent).toBeCloseTo(Number(s.percent.toFixed(1)), 10);
    });
  });

  it('breaks exposure ties by preserving input order', () => {
    const protocols = [
      makeProtocol('first'),
      makeProtocol('second'),
      makeProtocol('third'),
    ];
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth: () => 10,
    });
    expect(stats.slices.map((s) => s.label)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('falls back to the raw protocol string when protocolMap has no entry', () => {
    const p = makeProtocol('unknown');
    const stats = buildPortfolioStats({
      protocols: [p],
      protocolMap: {},
      getNetWorth: () => 10,
    });
    expect(stats.slices[0].label).toBe('unknown');
  });
});

describe('buildPortfolioSliceLookup', () => {
  it('keys top-N slices by protocol slug and excludes the Others bucket', () => {
    // Build a real top-6 portfolio: top-5 + Others. Lookup should
    // expose exactly the 5 jewel slices, never the aggregate.
    const protocols = ['a', 'b', 'c', 'd', 'e', 'f'].map((p) =>
      makeProtocol(p),
    );
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(protocols.map((p) => ({ protocol: p.protocol }))),
      getNetWorth: (p) => {
        const order = ['a', 'b', 'c', 'd', 'e', 'f'];
        const idx = order.indexOf(p.protocol);
        return [100, 80, 60, 40, 20, 5][idx];
      },
    });

    expect(stats.slices).toHaveLength(PORTFOLIO_TOP_N + 1); // 5 + Others
    const lookup = buildPortfolioSliceLookup(stats.slices);
    expect(lookup.size).toBe(PORTFOLIO_TOP_N);
    expect(lookup.has('a')).toBe(true);
    expect(lookup.has('e')).toBe(true);
    expect(lookup.has('others')).toBe(false);
    expect(lookup.has('f')).toBe(false);
    expect(lookup.get('a')?.colorToken).toBe(PORTFOLIO_PALETTE_TOKENS[0]);
  });

  it('returns an empty lookup when there are no slices', () => {
    expect(buildPortfolioSliceLookup([]).size).toBe(0);
  });
});
