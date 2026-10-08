import { buildStackedBarSegments } from './DeFiPortfolioStackedBarLayout';

import type { IPortfolioSlice } from './DeFiPortfolioStats';

const slice = (
  key: string,
  percent: number,
  colorToken = '$blue9',
  netWorth = percent * 10,
  networkIds: string[] = [],
): IPortfolioSlice => ({
  key,
  label: key,
  percent,
  netWorth,
  colorToken,
  networkIds,
});

describe('buildStackedBarSegments', () => {
  it('returns an empty array when no slices', () => {
    expect(buildStackedBarSegments([])).toEqual([]);
  });

  it('uses the slice percent verbatim for flexBasis', () => {
    const out = buildStackedBarSegments([slice('a', 60), slice('b', 40)]);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ key: 'a', flexBasis: 60 });
    expect(out[1]).toMatchObject({ key: 'b', flexBasis: 40 });
  });

  it('uses the same one-decimal percentage as the tooltip', () => {
    const out = buildStackedBarSegments([slice('a', 12.7)]);
    expect(out[0].label).toBe('12.7%');
  });

  it('preserves small non-zero allocation labels', () => {
    const out = buildStackedBarSegments([
      slice('main', 99.8),
      slice('others', 0.2, '$gray9', 0.04),
    ]);
    expect(out.map((segment) => segment.label)).toEqual(['99.8%', '0.2%']);
  });

  it('exposes colorToken and netWorth on the segment', () => {
    const [seg] = buildStackedBarSegments([
      { ...slice('k', 50, '$purple9', 1234), label: 'K' },
    ]);
    expect(seg.colorToken).toBe('$purple9');
    expect(seg.netWorth).toBe(1234);
    expect(seg.sliceLabel).toBe('K');
  });

  it('passes networkIds through transparently for tooltip multi-chain logos', () => {
    const out = buildStackedBarSegments([
      slice('aave', 50, '$blue9', 500, ['evm--1', 'evm--42161', 'evm--137']),
      slice('lido', 50, '$purple9', 500, ['evm--1']),
    ]);
    expect(out[0].networkIds).toEqual(['evm--1', 'evm--42161', 'evm--137']);
    expect(out[1].networkIds).toEqual(['evm--1']);
  });
});
