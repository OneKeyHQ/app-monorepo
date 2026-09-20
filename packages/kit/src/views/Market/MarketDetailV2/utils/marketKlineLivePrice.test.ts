import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  extractMarketKlineLivePrice,
  formatMarketKlineLivePrice,
  resolveMarketKlineLivePriceEnabled,
} from './marketKlineLivePrice';

function buildPoint({
  c,
  t,
}: {
  c: number;
  t: number;
}): IMarketTokenKLineDataPoint {
  return { o: c, h: c, l: c, c, v: 0, t };
}

describe('resolveMarketKlineLivePriceEnabled', () => {
  const baseParams = {
    currencyId: 'usd',
    networkId: 'evm--4663',
    priceMode: 'token' as const,
    tokenAddress: '0x020bfc650a365f8bb26819deaabf3e21291018b4',
  };

  it('enables the overlay for a USD token quote', () => {
    expect(resolveMarketKlineLivePriceEnabled(baseParams)).toBe(true);
  });

  it('skips a share quote, which the stock feed prices instead', () => {
    expect(
      resolveMarketKlineLivePriceEnabled({ ...baseParams, priceMode: 'share' }),
    ).toBe(false);
  });

  it('skips top coins, whose quote comes from the market asset feed', () => {
    expect(
      resolveMarketKlineLivePriceEnabled({
        ...baseParams,
        marketAssetId: 'bitcoin',
      }),
    ).toBe(false);
  });

  it('skips non-USD display currencies, which the K-line feed cannot quote', () => {
    expect(
      resolveMarketKlineLivePriceEnabled({ ...baseParams, currencyId: 'cny' }),
    ).toBe(false);
    expect(
      resolveMarketKlineLivePriceEnabled({
        ...baseParams,
        currencyId: undefined,
      }),
    ).toBe(false);
  });

  it('accepts a currency id in any case', () => {
    expect(
      resolveMarketKlineLivePriceEnabled({ ...baseParams, currencyId: 'USD' }),
    ).toBe(true);
  });

  it('requires a network and, for a contract token, its address', () => {
    expect(
      resolveMarketKlineLivePriceEnabled({ ...baseParams, networkId: '' }),
    ).toBe(false);
    expect(
      resolveMarketKlineLivePriceEnabled({ ...baseParams, tokenAddress: '' }),
    ).toBe(false);
  });

  // A native coin legitimately has no contract address, and the historical
  // series on the same chart already requests it that way.
  it('accepts a native coin with no contract address', () => {
    expect(
      resolveMarketKlineLivePriceEnabled({
        ...baseParams,
        isNative: true,
        tokenAddress: '',
      }),
    ).toBe(true);
  });

  it('still requires a network for a native coin', () => {
    expect(
      resolveMarketKlineLivePriceEnabled({
        ...baseParams,
        isNative: true,
        networkId: '',
        tokenAddress: '',
      }),
    ).toBe(false);
  });
});

describe('extractMarketKlineLivePrice', () => {
  it('reads the newest bucket close', () => {
    expect(
      extractMarketKlineLivePrice([
        buildPoint({ c: 0.176_69, t: 1_789_880_160 }),
        buildPoint({ c: 0.179_45, t: 1_789_880_220 }),
      ]),
    ).toBe(0.179_45);
  });

  it('picks the newest bucket even when the feed is unsorted', () => {
    expect(
      extractMarketKlineLivePrice([
        buildPoint({ c: 0.179_45, t: 1_789_880_220 }),
        buildPoint({ c: 0.176_69, t: 1_789_880_160 }),
      ]),
    ).toBe(0.179_45);
  });

  it('returns nothing for an empty or missing window', () => {
    expect(extractMarketKlineLivePrice([])).toBeUndefined();
    expect(extractMarketKlineLivePrice(undefined)).toBeUndefined();
  });

  it('rejects a close that cannot be a price', () => {
    expect(
      extractMarketKlineLivePrice([buildPoint({ c: 0, t: 1_789_880_220 })]),
    ).toBeUndefined();
    expect(
      extractMarketKlineLivePrice([buildPoint({ c: -1, t: 1_789_880_220 })]),
    ).toBeUndefined();
    expect(
      extractMarketKlineLivePrice([
        buildPoint({ c: Number.NaN, t: 1_789_880_220 }),
      ]),
    ).toBeUndefined();
  });

  it('ignores buckets carrying no usable timestamp', () => {
    expect(
      extractMarketKlineLivePrice([
        buildPoint({ c: 0.176_69, t: 1_789_880_160 }),
        buildPoint({ c: 0.999, t: Number.NaN }),
      ]),
    ).toBe(0.176_69);
  });
});

describe('formatMarketKlineLivePrice', () => {
  it('keeps a cheap token out of exponent notation', () => {
    expect(formatMarketKlineLivePrice(0.000_000_012_34)).toBe('0.00000001234');
  });

  it('preserves an ordinary price', () => {
    expect(formatMarketKlineLivePrice(0.179_45)).toBe('0.17945');
  });
});
