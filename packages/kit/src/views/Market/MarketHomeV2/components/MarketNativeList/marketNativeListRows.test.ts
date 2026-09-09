import {
  buildMarketNativeRowPatches,
  buildMarketNativeSnapshot,
  buildPerpsMarketRow,
  buildTokenMarketRow,
} from './marketNativeListRows';

import type { IMarketNativeListPresentation } from './marketNativeListRows';
import type { IMarketPerpsToken } from '../MarketPerpsList/hooks/useMarketPerpsTokenList';
import type { IMarketToken } from '../MarketTokenList/MarketTokenData';

const presentation: IMarketNativeListPresentation = {
  theme: {
    background: '#000000',
    rowBackground: '#000000',
    rowSelectedBackground: '#111111',
    rowPressedBackground: '#111111',
    subduedBackground: '#222222',
    strongBackground: '#333333',
    primaryText: '#ffffff',
    secondaryText: '#aaaaaa',
    disabledText: '#777777',
    icon: '#ffffff',
    iconSubdued: '#aaaaaa',
    separator: '#444444',
    accent: '#00ff00',
    positive: '#00ff00',
    negative: '#ff0000',
    criticalBackground: '#ff0000',
    inverseBackground: '#ffffff',
    inverseText: '#ffffff',
    info: '#0000ff',
  },
  positiveBackground: '#008000',
  negativeBackground: '#800000',
  neutralBackground: '#666666',
  infoBackground: '#001144',
  infoText: '#66aaff',
};

const token: IMarketToken = {
  id: 'token-id',
  name: 'Tiny Token',
  symbol: 'TINY',
  address: '0x1234',
  decimals: 18,
  price: 1.2e-7,
  change24h: 12.5,
  marketCap: 10_000,
  liquidity: 100,
  transactions: 10,
  uniqueTraders: 5,
  holders: 50,
  turnover: 123_456,
  tokenImageUri: 'https://example.com/token.png',
  networkLogoUri: 'https://example.com/network.png',
  networkId: 'evm--1',
  communityRecognized: true,
  stock: {
    subtitle: 'Tiny Corp',
    source: 'ondo',
    sourceLogoUri: 'https://example.com/ondo.png',
    title: 'Ondo',
    isOpen: true,
  },
};

const perp: IMarketPerpsToken = {
  name: 'xyz:BTC',
  displayName: 'BTC',
  dexLabel: 'xyz',
  maxLeverage: 40,
  subtitle: 'Bitcoin',
  tokenImageUrl: 'https://example.com/btc.png',
  markPrice: '12345.67',
  prevDayPrice: '12000',
  change24hPercent: -3.5,
  volume24h: '123456789',
  openInterest: '1000',
  fundingRate: '0.001',
};

describe('market native list rows', () => {
  it('preserves formatted tiny prices, native images, tags, and watchlist actions', () => {
    const row = buildTokenMarketRow({
      item: token,
      presentation,
      watchlist: true,
    });

    expect(row.key).toBe('evm--1:0x1234:0');
    expect(row.leading.kind).toBe('token');
    expect(row.priceSegments?.some((part) => part.style === 'subscript')).toBe(
      true,
    );
    expect(row.change.tone).toBe('positive');
    expect(row.change.backgroundColor).toBe('#008000');
    expect(row.badges?.map((badge) => badge.actionKey)).toEqual([
      'token-tags',
      'token-tags',
    ]);
    expect(row.longPressActionKey).toBe('watchlist-menu');
    expect(row.pressInActionKey).toBe('prewarm-detail');
  });

  it('serializes leverage and interactive DEX badges for perps', () => {
    const row = buildPerpsMarketRow({ item: perp, presentation });

    expect(row.variant).toBe('perp');
    expect(row.change.tone).toBe('negative');
    expect(row.badges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: '40x' }),
        expect.objectContaining({
          text: 'xyz',
          actionKey: 'perps-dex-info',
        }),
      ]),
    );
  });

  it('represents loading, retry, pagination, and end states in native rows', () => {
    const loading = buildMarketNativeSnapshot({
      rows: [],
      generation: 1,
      presentation,
      loading: true,
      noDataMessage: 'No data',
      retryMessage: 'Retry',
      contentPaddingBottom: 20,
    });
    const retry = buildMarketNativeSnapshot({
      rows: [],
      generation: 2,
      presentation,
      loading: false,
      errorMessage: 'Failed',
      noDataMessage: 'No data',
      retryMessage: 'Retry',
      contentPaddingBottom: 20,
    });
    const row = buildTokenMarketRow({ item: token, presentation });
    const loadMore = buildMarketNativeSnapshot({
      rows: [row],
      generation: 3,
      presentation,
      loading: false,
      loadMoreError: true,
      noDataMessage: 'No data',
      retryMessage: 'Retry',
      contentPaddingBottom: 20,
    });
    const end = buildMarketNativeSnapshot({
      rows: [row],
      generation: 4,
      presentation,
      loading: false,
      canLoadMore: false,
      noDataMessage: 'No data',
      retryMessage: 'Retry',
      contentPaddingBottom: 20,
    });

    expect(loading.rows).toHaveLength(10);
    expect(loading.rows[0]).toMatchObject({
      type: 'system',
      variant: 'loading',
    });
    expect(retry.rows[0]).toMatchObject({
      type: 'system',
      variant: 'retry',
      actionKey: 'retry',
    });
    expect(loadMore.rows.at(-1)).toMatchObject({
      type: 'system',
      variant: 'retry',
      actionKey: 'load-more-retry',
    });
    expect(end.rows.at(-1)).toMatchObject({
      type: 'system',
      variant: 'end',
    });
  });

  it('uses quote-only patches and falls back to snapshots for structural changes', () => {
    const previousRow = buildTokenMarketRow({ item: token, presentation });
    const nextRow = buildTokenMarketRow({
      item: { ...token, price: 1.3e-7, change24h: 13.5 },
      presentation,
    });
    const previous = buildMarketNativeSnapshot({
      rows: [previousRow],
      generation: 1,
      presentation,
      loading: false,
      canLoadMore: true,
      noDataMessage: 'No data',
      retryMessage: 'Retry',
      contentPaddingBottom: 20,
    });
    const next = buildMarketNativeSnapshot({
      rows: [nextRow],
      generation: 1,
      presentation,
      loading: false,
      canLoadMore: true,
      noDataMessage: 'No data',
      retryMessage: 'Retry',
      contentPaddingBottom: 20,
    });
    const structural = buildMarketNativeSnapshot({
      rows: [
        buildTokenMarketRow({
          item: { ...token, symbol: 'RENAMED' },
          presentation,
        }),
      ],
      generation: 1,
      presentation,
      loading: false,
      canLoadMore: true,
      noDataMessage: 'No data',
      retryMessage: 'Retry',
      contentPaddingBottom: 20,
    });

    expect(buildMarketNativeRowPatches(previous, next)).toEqual([
      expect.objectContaining({
        type: 'market',
        key: previousRow.key,
        changes: expect.not.objectContaining({ leading: expect.anything() }),
      }),
    ]);
    expect(buildMarketNativeRowPatches(previous, structural)).toBeUndefined();
  });
});
