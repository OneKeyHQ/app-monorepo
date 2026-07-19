import { applyMarketListLocalFilter } from './applyMarketListLocalFilter';
import { buildHotTokenFilterParams } from './marketListFilterConfig';
import { EMarketFilterDimension } from './marketListFilterTypes';

import type { IMarketToken } from '../MarketTokenList/MarketTokenData';

const now = 1_800_000_000_000;
const hours = (n: number) => n * 60 * 60 * 1000;
const tokens = [
  {
    id: 'young-small',
    firstTradeTime: now - hours(10),
    marketCap: 500_000,
    liquidity: 100_000,
  },
  {
    id: 'old-large',
    firstTradeTime: now - hours(1000),
    marketCap: 200_000_000,
    liquidity: 900_000,
  },
  { id: 'no-age', firstTradeTime: undefined, marketCap: 1000 },
] as IMarketToken[];

describe('applyMarketListLocalFilter', () => {
  it('returns input array as-is when no conditions', () => {
    expect(applyMarketListLocalFilter(tokens, {}, now)).toBe(tokens);
  });

  it('applies min-only threshold tiers', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        { [EMarketFilterDimension.Liquidity]: 'min-500000' },
        now,
      ).map((t) => t.id),
    ).toEqual(['old-large']);
  });

  it('applies bucket ranges with both bounds', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        { [EMarketFilterDimension.MarketCap]: 'small' },
        now,
      ).map((t) => t.id),
    ).toEqual(['young-small']);
  });

  it('applies age ceilings and drops rows missing the field', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        { [EMarketFilterDimension.TokenAge]: 'under-48h' },
        now,
      ).map((t) => t.id),
    ).toEqual(['young-small']);
  });

  it('ANDs multiple conditions', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        {
          [EMarketFilterDimension.MarketCap]: 'large',
          [EMarketFilterDimension.Liquidity]: 'min-500000',
        },
        now,
      ).map((t) => t.id),
    ).toEqual(['old-large']);
  });

  it('ignores unknown option ids', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        { [EMarketFilterDimension.MarketCap]: 'nope' },
        now,
      ).map((t) => t.id),
    ).toEqual(['young-small', 'old-large', 'no-age']);
  });
});

describe('buildHotTokenFilterParams', () => {
  it('expands buckets into min/max hot-token params', () => {
    expect(
      buildHotTokenFilterParams({
        [EMarketFilterDimension.MarketCap]: 'small',
        [EMarketFilterDimension.Liquidity]: 'min-5000',
      }),
    ).toEqual({
      marketCapMin: 100_000,
      marketCapMax: 1_000_000,
      liquidityMin: 5000,
    });
  });

  it('emits nothing for dimensions without server params', () => {
    expect(
      buildHotTokenFilterParams({
        [EMarketFilterDimension.TokenAge]: 'under-48h',
      }),
    ).toEqual({});
  });
});
