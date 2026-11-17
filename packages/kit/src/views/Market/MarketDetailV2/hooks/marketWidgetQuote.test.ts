import type {
  IMarketStockPublicDetail,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

import {
  buildMarketWidgetStockQuote,
  buildMarketWidgetTokenQuote,
} from './marketWidgetQuote';

const now = 1_800_000_000_000;
const token: IMarketTokenDetail = {
  address: '0xabc',
  networkId: 'evm--1',
  symbol: 'TEST',
  name: 'Token',
  logoUrl: '',
  decimals: 18,
  price: '100',
  priceConverted: '720',
  priceObservedAt: now - 1000,
  priceChange24hPercent: '1.25',
};
const target = { networkId: 'evm--1', tokenAddress: '0xabc', isNative: false };

describe('widget detail quotes', () => {
  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(now));
  afterEach(() => jest.restoreAllMocks());

  it('copies the USD quote and original timestamp, never the converted price', () => {
    const update = buildMarketWidgetTokenQuote({
      ...target,
      tokenDetail: token,
    });
    expect(update).toMatchObject({
      currency: 'usd',
      quote: {
        price: '100',
        fetchedAt: now - 1000,
        change24h: '1.25',
        asset: { kind: 'token', chainId: 'evm--1', contractAddress: '0xabc' },
      },
    });
    expect(
      buildMarketWidgetTokenQuote({
        ...target,
        assetId: 'btc',
        tokenDetail: token,
      })?.quote.asset,
    ).toMatchObject({ kind: 'asset', assetId: 'btc' });
  });

  it('rejects stale, unobserved, invalid and mismatched detail data', () => {
    for (const data of [
      { ...token, priceObservedAt: undefined },
      { ...token, priceObservedAt: now - 300_000 },
      { ...token, priceObservedAt: now + 1 },
      { ...token, price: 'NaN' },
      { ...token, networkId: 'evm--10' },
      { ...token, address: '0xdef' },
    ]) {
      expect(
        buildMarketWidgetTokenQuote({ ...target, tokenDetail: data }),
      ).toBeUndefined();
    }
  });

  it('retains the native route identity when the API echoes a native address', () => {
    expect(
      buildMarketWidgetTokenQuote({
        ...target,
        tokenAddress: '',
        isNative: true,
        tokenDetail: token,
      })?.quote.asset,
    ).toMatchObject({
      kind: 'token',
      contractAddress: '',
      requestTokenAddress: '0xabc',
      isNative: true,
    });
  });

  it('keeps stock quotes separate, including closed sessions and bounded curves', () => {
    const stock: IMarketStockPublicDetail = {
      stockId: 'NVDA',
      symbol: 'NVDA',
      name: 'NVIDIA',
      logoUrl: '',
      assetType: 'stock',
      currency: 'USD',
      categories: [],
      aliases: [],
      price: '205',
      marketStatus: { isOpen: false },
      priceUpdatedAt: new Date(now - 86_400_000).toISOString(),
      sparkline: Array.from({ length: 1000 }, (_, i) => 200 + i),
    };
    const quote = buildMarketWidgetStockQuote(stock, now - 1000)?.quote;
    expect(quote).toMatchObject({
      price: '205',
      marketClosed: true,
      priceUpdatedAt: now - 86_400_000,
      asset: { kind: 'stock', stockId: 'NVDA' },
    });
    expect(quote?.stockSparkline).toHaveLength(96);
    expect(quote?.stockSparkline?.at(-1)).toBe(1199);
    expect(buildMarketWidgetStockQuote(stock, undefined)).toBeUndefined();
  });
});
