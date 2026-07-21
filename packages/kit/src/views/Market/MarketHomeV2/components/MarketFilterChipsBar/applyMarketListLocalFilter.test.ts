import { applyMarketListLocalFilter } from './applyMarketListLocalFilter';
import {
  MARKET_FILTER_CHIPS,
  buildHotTokenFilterParams,
  findActiveMarketFilterChip,
  getMarketFilterOption,
} from './marketListFilterConfig';
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

  it('applies market cap floors', () => {
    expect(
      applyMarketListLocalFilter(
        tokens,
        { [EMarketFilterDimension.MarketCap]: 'min-100000000' },
        now,
      ).map((t) => t.id),
    ).toEqual(['old-large']);
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
          [EMarketFilterDimension.MarketCap]: 'min-10000000',
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
        [EMarketFilterDimension.MarketCap]: 'min-500000',
        [EMarketFilterDimension.Liquidity]: 'min-10000',
      }),
    ).toEqual({
      marketCapMin: 500_000,
      liquidityMin: 10_000,
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

describe('MARKET_FILTER_CHIPS', () => {
  // "chip 值 ⊆ 檔位集": a chip threshold with no matching tier could not be
  // shown as selected in the popover, which is where chip<->popover sync
  // would silently break.
  it('only uses conditions the popover tier table can express', () => {
    MARKET_FILTER_CHIPS.forEach((chip) => {
      Object.entries(chip.conditions).forEach(([dimensionId, optionId]) => {
        expect(
          getMarketFilterOption(
            dimensionId as EMarketFilterDimension,
            optionId,
          ),
        ).toBeDefined();
      });
    });
  });
});

describe('findActiveMarketFilterChip', () => {
  const largeCap = MARKET_FILTER_CHIPS.find((c) => c.id === 'largeCap');
  const topTurnover = MARKET_FILTER_CHIPS.find((c) => c.id === 'topTurnover');

  it('lights a chip whose exact condition set is applied', () => {
    expect(findActiveMarketFilterChip(largeCap?.conditions ?? {}, {})?.id).toBe(
      'largeCap',
    );
  });

  it('lights a chip when the same set is assembled by hand', () => {
    expect(
      findActiveMarketFilterChip(
        {
          [EMarketFilterDimension.Turnover]: 'min-100000',
          [EMarketFilterDimension.Liquidity]: 'min-50000',
          [EMarketFilterDimension.MarketCap]: 'min-1000000',
        },
        {},
      )?.id,
    ).toBe('largeCap');
  });

  it('dims the chip once any tier deviates', () => {
    expect(
      findActiveMarketFilterChip(
        {
          ...largeCap?.conditions,
          [EMarketFilterDimension.MarketCap]: 'min-10000000',
        },
        {},
      ),
    ).toBeUndefined();
  });

  it('dims a superset of the chip conditions', () => {
    expect(
      findActiveMarketFilterChip(
        {
          ...largeCap?.conditions,
          [EMarketFilterDimension.Txns]: 'min-100',
        },
        {},
      ),
    ).toBeUndefined();
  });

  // The sort-bearing chip needs both halves to match, so sorting another
  // column from the table header dims it with no extra bookkeeping.
  it('requires the sort to match for a sort-bearing chip', () => {
    expect(
      findActiveMarketFilterChip(topTurnover?.conditions ?? {}, {
        sortBy: 'turnover',
        sortType: 'desc',
      })?.id,
    ).toBe('topTurnover');
    expect(
      findActiveMarketFilterChip(topTurnover?.conditions ?? {}, {
        sortBy: 'marketCap',
        sortType: 'desc',
      }),
    ).toBeUndefined();
    expect(
      findActiveMarketFilterChip(topTurnover?.conditions ?? {}, {}),
    ).toBeUndefined();
  });
});
