import {
  getStockMarketCapValue,
  getStockPeRatioValue,
  getStockVolume24hValue,
  normalizeStockMetadataValue,
  shouldShowStockSubtitleForTokens,
  shouldUseStockMetadataColumnsForTokens,
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
