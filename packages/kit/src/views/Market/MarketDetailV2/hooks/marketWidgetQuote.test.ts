import type {
  IMarketStockPublicDetail,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

import {
  buildMarketWidgetStockQuote,
  buildMarketWidgetTokenQuote,
} from './marketWidgetQuote';

const now = 1_800_000_000_000;
const detailQuote = { price: '100', change24h: '1.25', fetchedAt: now - 1000 };
const token: IMarketTokenDetail = {
  address: '0xabc',
  networkId: 'evm--1',
  symbol: 'TEST',
  name: 'Token',
  logoUrl: '',
  decimals: 18,
  price: '100',
  priceConverted: '720',
  widgetDetailQuote: detailQuote,
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
        tokenDetail: {
          ...token,
          widgetDetailQuote: { ...detailQuote, assetId: 'btc' },
        },
      })?.quote.asset,
    ).toMatchObject({ kind: 'asset', assetId: 'btc' });
  });

  it('rejects stale, unobserved, invalid and mismatched detail data', () => {
    for (const data of [
      { ...token, widgetDetailQuote: undefined },
      {
        ...token,
        widgetDetailQuote: { ...detailQuote, fetchedAt: now - 300_000 },
      },
      { ...token, widgetDetailQuote: { ...detailQuote, fetchedAt: now + 1 } },
      { ...token, widgetDetailQuote: { ...detailQuote, price: 'NaN' } },
      { ...token, widgetDetailQuote: { ...detailQuote, assetId: 'btc' } },
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
        tokenDetail: { ...token, isNative: true },
      })?.quote.asset,
    ).toMatchObject({
      kind: 'token',
      contractAddress: '',
      requestTokenAddress: '0xabc',
      isNative: true,
    });
  });

  it('keeps the pinned native identity while validating the resolved asset quote', () => {
    const resolved = {
      ...token,
      networkId: 'sol--101',
      address: 'native',
      isNative: true,
      widgetDetailQuote: { ...detailQuote, assetId: 'sol' },
    };
    const nativeTarget = {
      assetId: 'sol',
      networkId: 'sol--101',
      tokenAddress: '',
      isNative: true,
      marketWidgetToken: {
        networkId: 'sol--101',
        tokenAddress: '',
        isNative: true,
      },
    };
    expect(
      buildMarketWidgetTokenQuote({ ...nativeTarget, tokenDetail: resolved })
        ?.quote,
    ).toMatchObject({
      asset: {
        kind: 'token',
        chainId: 'sol--101',
        contractAddress: '',
        requestTokenAddress: 'native',
        isNative: true,
      },
      price: detailQuote.price,
      fetchedAt: detailQuote.fetchedAt,
    });
    expect(
      buildMarketWidgetTokenQuote({
        ...nativeTarget,
        tokenDetail: {
          ...resolved,
          widgetDetailQuote: { ...detailQuote, assetId: 'eth' },
        },
      }),
    ).toBeUndefined();
    expect(
      buildMarketWidgetTokenQuote({
        ...nativeTarget,
        marketWidgetToken: {
          networkId: 'evm--1',
          tokenAddress: '',
          isNative: true,
        },
        tokenDetail: resolved,
      })?.quote.asset,
    ).toMatchObject({ kind: 'asset', assetId: 'sol' });
    expect(
      buildMarketWidgetTokenQuote({
        ...target,
        marketWidgetToken: { ...target, tokenAddress: 'different' },
        tokenDetail: token,
      })?.quote.asset,
    ).toMatchObject({ kind: 'token', contractAddress: target.tokenAddress });
  });

  it('rejects a stale same-network contract detail on a native route', () => {
    for (const isNative of [false, undefined]) {
      expect(
        buildMarketWidgetTokenQuote({
          ...target,
          tokenAddress: '',
          isNative: true,
          tokenDetail: { ...token, isNative },
        }),
      ).toBeUndefined();
    }
  });

  it('uses both fields from the last detail response after a live chart tick', () => {
    const detailFetchedAt = now - 2000;
    expect(
      buildMarketWidgetTokenQuote({
        ...target,
        tokenDetail: {
          ...token,
          price: '990',
          priceChange24hPercent: '3',
          chartPriceUpdatedAt: now - 1000,
          widgetDetailQuote: {
            price: '100',
            change24h: '2',
            fetchedAt: detailFetchedAt,
          },
        },
      })?.quote,
    ).toMatchObject({
      price: '100',
      fetchedAt: detailFetchedAt,
      change24h: '2',
      isDetailQuote: true,
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
