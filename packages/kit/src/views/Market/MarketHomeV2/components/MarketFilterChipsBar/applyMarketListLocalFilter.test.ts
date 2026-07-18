import { applyMarketListLocalFilter } from './applyMarketListLocalFilter';
import { EMarketFilterField } from './marketListFilterTypes';

import type { IMarketToken } from '../MarketTokenList/MarketTokenData';

const now = 1_800_000_000_000;
const hours = (n: number) => n * 60 * 60 * 1000;
const tokens = [
  {
    id: 'young-big',
    firstTradeTime: now - hours(10),
    marketCap: 5_000_000,
    liquidity: 100_000,
  },
  {
    id: 'old-big',
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

  it('applies gte condition', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        { [EMarketFilterField.MarketCapMin]: 100_000_000 },
        now,
      ).map((t) => t.id),
    ).toEqual(['old-big']);
  });

  it('applies lte token age and drops rows missing the field', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        { [EMarketFilterField.TokenAgeMax]: hours(48) },
        now,
      ).map((t) => t.id),
    ).toEqual(['young-big']);
  });

  it('ANDs multiple conditions and skips fields without local data source', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        {
          [EMarketFilterField.MarketCapMin]: 1_000_000,
          [EMarketFilterField.InflowUsdMin]: 1000,
        },
        now,
      ).map((t) => t.id),
    ).toEqual(['young-big', 'old-big']);
  });
});
