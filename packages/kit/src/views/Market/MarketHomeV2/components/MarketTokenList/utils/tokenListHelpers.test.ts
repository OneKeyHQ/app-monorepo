import {
  getStockMarketCapValue,
  getStockPeRatioValue,
  getStockVolume24hValue,
  normalizeStockMetadataValue,
  shouldShowStockSubtitleForTokens,
  shouldUseStockMetadataColumnsForTokens,
  transformApiItemToToken,
} from './tokenListHelpers';

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
