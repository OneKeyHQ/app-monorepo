import {
  calculateMarketTokenLivePriceChange,
  filterInjectedBtcRow,
  getStockMarketCapValue,
  getStockPeRatioValue,
  getStockVolume24hValue,
  hasReachedEndAfterFirstPage,
  normalizeStockMetadataValue,
  shouldHideInjectedBtcRowForType,
  shouldShowStockSubtitleForTokens,
  shouldUseStockMetadataColumnsForTokens,
  transformApiItemToToken,
} from './tokenListHelpers';

import type { IMarketToken } from '../MarketTokenData';

describe('stock metadata values', () => {
  test('normalizes numeric metadata values', () => {
    expect(normalizeStockMetadataValue(' 123.45 ')).toBe('123.45');
    expect(normalizeStockMetadataValue(0)).toBe('0');
  });

  test('returns undefined for missing or invalid metadata values', () => {
    expect(normalizeStockMetadataValue(undefined)).toBeUndefined();
    expect(normalizeStockMetadataValue(null)).toBeUndefined();
    expect(normalizeStockMetadataValue('')).toBeUndefined();
    expect(normalizeStockMetadataValue(' - ')).toBeUndefined();
  });

  test('reads display metrics only from stock metadata', () => {
    const record = {
      stock: {
        subtitle: 'Apple',
        sourceLogoUri: '',
        marketCap: '3100000000000',
        assetAnalysis: {
          volume24h: '150000000',
        },
        tradingActivity: {
          peRatio: '28.4',
        },
      },
    };

    expect(getStockMarketCapValue(record)).toBe('3100000000000');
    expect(getStockVolume24hValue(record)).toBe('150000000');
    expect(getStockPeRatioValue(record)).toBe('28.4');
  });

  test('does not provide fallback values when stock metadata is missing', () => {
    const record = {
      stock: {
        subtitle: 'Apple',
        sourceLogoUri: '',
      },
    };

    expect(getStockMarketCapValue(record)).toBeUndefined();
    expect(getStockVolume24hValue(record)).toBeUndefined();
    expect(getStockPeRatioValue(record)).toBeUndefined();
  });

  test('uses stock display metrics before token list metrics', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Stock Token',
        symbol: 'STOCK',
        decimals: 18,
        marketCap: '1000',
        volume24h: '2000',
        stock: {
          subtitle: 'Stock Token Inc.',
          sourceLogoUri: '',
          marketCap: '3000',
          assetAnalysis: {
            volume24h: '4000',
          },
        },
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
      },
    );

    expect(token.marketCap).toBe(3000);
    expect(token.turnover).toBe(4000);
  });

  test('uses 24h price change for stock rows regardless of selected time range', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Stock Token',
        symbol: 'STOCK',
        decimals: 18,
        priceChange1hPercent: '12.34',
        priceChange24hPercent: '-0.62',
        price1hAgo: '88',
        price24hAgo: '100',
        stock: {
          subtitle: 'Stock Token Inc.',
          sourceLogoUri: '',
        },
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
        timeRange: '1h',
      },
    );

    expect(token.change24h).toBe(-0.62);
    expect(token.priceChangeBasePrice).toBe(100);
    expect(token.priceChangeRaw).toBe('-0.62');
  });

  test('keeps raw dash price change without treating zero as missing', () => {
    const baseToken = {
      address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
      name: 'Token',
      symbol: 'TOKEN',
      decimals: 18,
    };

    const missingChangeToken = transformApiItemToToken(
      {
        ...baseToken,
        priceChange24hPercent: '-',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
      },
    );
    const zeroChangeToken = transformApiItemToToken(
      {
        ...baseToken,
        priceChange24hPercent: '0',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
      },
    );

    expect(missingChangeToken.change24h).toBe(0);
    expect(missingChangeToken.priceChangeRaw).toBe('-');
    expect(zeroChangeToken.change24h).toBe(0);
    expect(zeroChangeToken.priceChangeRaw).toBe('0');
  });

  test('keeps raw dash price change in selected time range', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Token',
        symbol: 'TOKEN',
        decimals: 18,
        priceChange1hPercent: '-',
        priceChange24hPercent: '1',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
        timeRange: '1h',
      },
    );

    expect(token.change24h).toBe(0);
    expect(token.priceChangeRaw).toBe('-');
  });
});

describe('market home live price change', () => {
  test('stores the selected time range base price for websocket recalculation', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Token',
        symbol: 'TOKEN',
        decimals: 18,
        priceChange1hPercent: '20',
        priceChange24hPercent: '50',
        price1hAgo: '10',
        price24hAgo: '8',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
        timeRange: '1h',
      },
    );

    expect(token.change24h).toBe(20);
    expect(token.priceChangeBasePrice).toBe(10);
  });

  test('uses the 24h base price for the 24h time range', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Token',
        symbol: 'TOKEN',
        decimals: 18,
        priceChange24hPercent: '50',
        price24hAgo: '8',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
        timeRange: '24h',
      },
    );

    expect(token.priceChangeBasePrice).toBe(8);
  });

  test('does not fall back to 24h base price when the selected time range base is missing', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Token',
        symbol: 'TOKEN',
        decimals: 18,
        priceChange1hPercent: '20',
        priceChange24hPercent: '50',
        price24hAgo: '8',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
        timeRange: '1h',
      },
    );

    expect(token.priceChangeBasePrice).toBeUndefined();
  });

  test('does not fall back to 24h base price when the selected time range base is a placeholder', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Token',
        symbol: 'TOKEN',
        decimals: 18,
        priceChange1hPercent: '20',
        priceChange24hPercent: '50',
        price1hAgo: '-',
        price24hAgo: '8',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
        timeRange: '1h',
      },
    );

    expect(token.priceChangeBasePrice).toBeUndefined();
  });

  test('ignores backend placeholder base prices', () => {
    const token = transformApiItemToToken(
      {
        address: '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4',
        name: 'Token',
        symbol: 'TOKEN',
        decimals: 18,
        priceChange24hPercent: '50',
        price24hAgo: '-',
      },
      {
        chainId: 'evm--1',
        networkLogoUri: '',
        timeRange: '24h',
      },
    );

    expect(token.priceChangeBasePrice).toBeUndefined();
  });

  test('calculates live price change from websocket price and base price', () => {
    expect(
      calculateMarketTokenLivePriceChange({
        price: 12,
        priceChangeBasePrice: 10,
      }),
    ).toBe(20);

    expect(
      calculateMarketTokenLivePriceChange({
        price: 8,
        priceChangeBasePrice: 10,
      }),
    ).toBe(-20);
  });

  test('skips live price change when price or base price is invalid', () => {
    expect(
      calculateMarketTokenLivePriceChange({
        price: 12,
        priceChangeBasePrice: undefined,
      }),
    ).toBeUndefined();
    expect(
      calculateMarketTokenLivePriceChange({
        price: 0,
        priceChangeBasePrice: 10,
      }),
    ).toBeUndefined();
    expect(
      calculateMarketTokenLivePriceChange({
        price: 12,
        priceChangeBasePrice: 0,
      }),
    ).toBeUndefined();
  });
});

describe('shouldShowStockSubtitleForTokens', () => {
  test('returns false for empty data', () => {
    expect(shouldShowStockSubtitleForTokens([])).toBe(false);
  });

  test('returns true when at least half of rows are stocks', () => {
    expect(
      shouldShowStockSubtitleForTokens([
        { stock: { subtitle: 'Apple', sourceLogoUri: '' } },
        { stock: { subtitle: 'Tesla', sourceLogoUri: '' } },
        { stock: { subtitle: 'NVIDIA', sourceLogoUri: '' } },
        { stock: { subtitle: 'Microsoft', sourceLogoUri: '' } },
        { stock: { subtitle: 'Amazon', sourceLogoUri: '' } },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
      ]),
    ).toBe(true);
  });

  test('returns false when stock rows are less than half', () => {
    expect(
      shouldShowStockSubtitleForTokens([
        { stock: { subtitle: 'Apple', sourceLogoUri: '' } },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
        { stock: undefined },
      ]),
    ).toBe(false);
  });
});

describe('shouldUseStockMetadataColumnsForTokens', () => {
  test('returns true only when all rows are stocks', () => {
    expect(
      shouldUseStockMetadataColumnsForTokens([
        { stock: { subtitle: 'Apple', sourceLogoUri: '' } },
        { stock: { subtitle: 'Tesla', sourceLogoUri: '' } },
      ]),
    ).toBe(true);
  });

  test('returns false for empty or mixed data', () => {
    expect(shouldUseStockMetadataColumnsForTokens([])).toBe(false);
    expect(
      shouldUseStockMetadataColumnsForTokens([
        { stock: { subtitle: 'Apple', sourceLogoUri: '' } },
        { stock: undefined },
      ]),
    ).toBe(false);
  });
});

describe('filterInjectedBtcRow', () => {
  it('removes the backend-injected native BTC row only', () => {
    const tokens = [
      { id: 'btc', networkId: 'btc--0', isNative: true, symbol: 'BTC' },
      { id: 'wbtc', networkId: 'evm--1', isNative: false, symbol: 'WBTC' },
      { id: 'sol', networkId: 'sol--101', isNative: true, symbol: 'SOL' },
    ] as IMarketToken[];
    expect(filterInjectedBtcRow(tokens).map((t) => t.id)).toEqual([
      'wbtc',
      'sol',
    ]);
  });
});

describe('shouldHideInjectedBtcRowForType', () => {
  it('hides the BTC row only for the trending list', () => {
    expect(shouldHideInjectedBtcRowForType('trending')).toBe(true);
  });

  it('leaves other list types untouched', () => {
    expect(shouldHideInjectedBtcRowForType('stocks')).toBe(false);
    expect(shouldHideInjectedBtcRowForType(undefined)).toBe(false);
  });
});

describe('hasReachedEndAfterFirstPage', () => {
  it('locks pagination when the trending backend already returned the full pool on page 1', () => {
    // Regression for the BTC-hide pagination-guard bug: filtering the
    // injected BTC row shrinks transformedData.length below `total`
    // (e.g. 81 % 20 === 1), which would otherwise make canLoadMore true
    // and re-trigger loadMore against a backend that ignores page/limit
    // and just re-returns (and re-appends) the whole unfiltered pool.
    expect(
      hasReachedEndAfterFirstPage({
        type: 'trending',
        rawListLength: 81,
        total: 81,
      }),
    ).toBe(true);
  });

  it('does not lock pagination when the trending pool is genuinely paginated', () => {
    expect(
      hasReachedEndAfterFirstPage({
        type: 'trending',
        rawListLength: 20,
        total: 81,
      }),
    ).toBe(false);
  });

  it('never locks pagination for list types that do not hide the BTC row', () => {
    expect(
      hasReachedEndAfterFirstPage({
        type: 'stocks',
        rawListLength: 81,
        total: 81,
      }),
    ).toBe(false);
    expect(
      hasReachedEndAfterFirstPage({
        type: undefined,
        rawListLength: 81,
        total: 81,
      }),
    ).toBe(false);
  });

  it('ignores an unknown/zero total instead of locking prematurely', () => {
    expect(
      hasReachedEndAfterFirstPage({
        type: 'trending',
        rawListLength: 0,
        total: 0,
      }),
    ).toBe(false);
  });
});
