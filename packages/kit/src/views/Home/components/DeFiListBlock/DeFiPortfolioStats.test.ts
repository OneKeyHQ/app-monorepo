import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import {
  PORTFOLIO_OTHERS_TOKEN,
  PORTFOLIO_PALETTE_TOKENS,
} from './DeFiPortfolioPalette';
import { PORTFOLIO_TOP_N, buildPortfolioStats } from './DeFiPortfolioStats';

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

  it('returns 5 slices and no Others when given exactly TOP_N protocols', () => {
    const protocols = Array.from({ length: PORTFOLIO_TOP_N }, (_, i) =>
      makeProtocol(`p${i}`),
    );
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

  it('emits zero percents when total is zero', () => {
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
    expect(stats.slices.every((s) => s.percent === 0)).toBe(true);
  });

  it('rounds percents to one decimal and keeps sum within 0.1 of 100', () => {
    const protocols = Array.from({ length: 3 }, (_, i) =>
      makeProtocol(`p${i}`),
    );
    const values = [1, 1, 1];
    const stats = buildPortfolioStats({
      protocols,
      protocolMap: makeMap(
        protocols.map((p) => ({ protocol: p.protocol, name: p.protocol })),
      ),
      getNetWorth: (p) => values[Number(p.protocol.slice(1))],
    });
    const sum = stats.slices.reduce((acc, s) => acc + s.percent, 0);
    // ± 0.15 to absorb one-decimal rounding AND float accumulation error
    // (e.g. 33.3 + 33.3 + 33.3 = 99.8999…).
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.15);
    stats.slices.forEach((s) => {
      // percent already rounded; toFixed(1) round-trip must match.
      expect(s.percent).toBeCloseTo(Number(s.percent.toFixed(1)), 10);
    });
  });

  it('breaks ties by preserving input order', () => {
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
