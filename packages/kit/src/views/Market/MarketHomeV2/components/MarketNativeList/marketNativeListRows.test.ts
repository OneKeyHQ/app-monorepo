import {
  buildMarketNativeRowPatches,
  buildMarketNativeSnapshot,
  buildPerpsMarketRow,
  buildStockMarketRow,
  buildTokenMarketRow,
  buildTopCoinMarketRow,
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
    inverseText: '#000000',
    info: '#0000ff',
  },
  communityRecognizedAccessibilityLabel: 'Community recognized',
  leverageAccessibilityLabel: 'Leverage',
  providerAccessibilityLabel: 'Provider',
  positiveBackground: '#008000',
  negativeBackground: '#800000',
  neutralBackground: '#666666',
  infoBackground: '#001144',
  infoText: '#66aaff',
  tokenBackground: '#ffffff2c',
  tokenBorderColor: '#ffffff09',
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
  it('keeps listing favorites distinct when their chain addresses are empty', () => {
    const items = [
      { assetId: 'bitcoin' },
      { assetId: 'ethereum' },
      { stockId: 'AAPL' },
      { stockId: 'MSFT' },
    ];
    const rows = items.map((identity) =>
      buildTokenMarketRow({
        item: { ...token, address: '', networkId: '', ...identity },
        presentation,
        watchlist: true,
      }),
    );
    expect(rows.map((row) => row.key)).toEqual([
      'asset:bitcoin',
      'asset:ethereum',
      'stock:AAPL',
      'stock:MSFT',
    ]);
  });

  it.each(['#000000', '#ffffff'])(
    'keeps the legacy white change text when inverse text is %s',
    (inverseText) => {
      const themedPresentation = {
        ...presentation,
        theme: { ...presentation.theme, inverseText },
      };
      for (const change of [3.54, -2.66, 0, undefined]) {
        const tokenItem = {
          ...token,
          change24h: change ?? 0,
          priceChangeRaw: change === undefined ? '-' : undefined,
        };
        const rows = [
          buildTokenMarketRow({
            item: tokenItem,
            presentation: themedPresentation,
          }),
          buildTokenMarketRow({
            item: tokenItem,
            presentation: themedPresentation,
            watchlist: true,
          }),
          buildStockMarketRow({
            item: {
              stockId: 'A',
              symbol: 'A',
              name: 'Agilent Technologies',
              logoUrl: 'https://example.com/stock.png',
              assetType: 'stock',
              currency: 'USD',
              price: '146.85',
              priceChange24hPercent: change?.toString(),
            },
            presentation: themedPresentation,
          }),
          buildTopCoinMarketRow({
            item: {
              assetId: 'bitcoin',
              symbol: 'btc',
              logoUrl: 'https://example.com/btc.png',
              price: '100',
              priceChange24hPercent: change?.toString() ?? '-',
              priceChange7dPercent: '0',
              marketCap: '1000',
              volume24h: '100',
              sparkline24h: [],
            },
            presentation: themedPresentation,
          }),
          buildPerpsMarketRow({
            item: { ...perp, change24hPercent: change ?? 0 },
            presentation: themedPresentation,
          }),
        ];
        for (const row of rows) {
          expect(row.change.textColor).toBe('#ffffff');
        }
      }
    },
  );

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
    expect(row.badges?.[1]?.accessibilityLabel).toBe(
      'TINY, Community recognized',
    );
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
    expect(row.badges?.map((badge) => badge.accessibilityLabel)).toEqual([
      '40x, Leverage',
      'xyz, Provider',
    ]);
    expect(row.style?.titleBadgeLayout).toBe('inline');
    expect(row.badges?.map((badge) => badge.style)).toEqual([
      {
        fontSize: 10,
        fontWeight: 'regular',
        lineHeight: 16,
        height: 16,
        horizontalPadding: 4,
      },
      {
        fontSize: 10,
        fontWeight: 'regular',
        lineHeight: 16,
        height: 16,
        horizontalPadding: 4,
      },
    ]);
  });

  it('preserves zero perpetual volume and independently truncates the localized name', () => {
    const standalone = buildPerpsMarketRow({
      item: { ...perp, volume24h: '0' },
      presentation,
    });
    expect(standalone.subtitle).toBe('$0');
    expect(standalone.subtitlePrefix).toMatchObject({
      text: 'Bitcoin',
      gap: 4,
      style: { fontSize: 12, lineHeight: 16 },
    });
    const watchlist = buildTokenMarketRow({ item: token, presentation });
    expect(watchlist.subtitle).toBe('$123.46K');
    expect(watchlist.subtitlePrefix).toMatchObject({
      text: 'Tiny Corp',
      gap: 6,
      maxWidth: 66,
      style: { fontSize: 12, lineHeight: 16 },
    });
    const noVolume = buildTokenMarketRow({
      item: { ...token, turnover: 0 },
      presentation,
    });
    expect(noVolume.subtitle).toBeUndefined();
    expect(noVolume.subtitlePrefix?.text).toBe('Tiny Corp');
    const withoutName = buildTokenMarketRow({
      item: { ...token, stock: undefined },
      presentation,
    });
    expect(withoutName.subtitlePrefix).toBeUndefined();
  });

  it('preserves the distinct standalone and watchlist perpetual row layouts', () => {
    const standalone = buildPerpsMarketRow({ item: perp, presentation });
    const watchlist = buildTokenMarketRow({
      item: { ...token, perpsCoin: perp.name, maxLeverage: 40 },
      presentation,
      watchlist: true,
    });

    expect(standalone.height).toBe(64);
    expect(standalone.style).toMatchObject({
      horizontalPadding: 16,
      leadingGap: 8,
      lineGap: 0,
      subtitle: { fontSize: 12, lineHeight: 16 },
    });
    expect(watchlist.height).toBe(72);
    expect(watchlist.style).toMatchObject({
      horizontalPadding: 20,
      leadingGap: 14,
      lineGap: 4,
      subtitle: { fontSize: 14, lineHeight: 20 },
    });
    expect(
      watchlist.badges?.map((badge) => badge.style?.horizontalPadding),
    ).toEqual([6, 6]);
  });

  it('restores token image decoration and badge order from the legacy mobile row', () => {
    const dark = buildTokenMarketRow({
      item: token,
      presentation: {
        ...presentation,
        tokenBackground: '#ffffff2c',
        tokenBorderColor: '#ffffff09',
      },
    });
    const light = buildTokenMarketRow({
      item: token,
      presentation: {
        ...presentation,
        tokenBackground: '#ffffff',
        tokenBorderColor: undefined,
      },
    });

    expect(dark.leading).toMatchObject({
      backgroundColor: '#ffffff2c',
      borderColor: '#ffffff09',
    });
    expect(light.leading).toMatchObject({ backgroundColor: '#ffffff' });
    expect(light.leading).not.toHaveProperty('borderColor', expect.anything());
    expect(dark.badges?.map((badge) => badge.accessibilityLabel)).toEqual([
      'Ondo',
      'TINY, Community recognized',
    ]);
  });

  it('preserves Android fractional token row edges across appended pages', () => {
    const rows = Array.from({ length: 20 }, (_, index) =>
      buildTokenMarketRow({
        item: { ...token, address: `0x${index}` },
        presentation,
      }),
    );
    const androidPresentation = { ...presentation, androidPixelRatio: 2.625 };
    const snapshot = (
      count: number,
      themedPresentation = androidPresentation,
    ) =>
      buildMarketNativeSnapshot({
        rows: rows.slice(0, count),
        generation: 1,
        presentation: themedPresentation,
        loading: false,
        canLoadMore: true,
        noDataMessage: 'No data',
        retryMessage: 'Retry',
        contentPaddingBottom: 20,
      });
    const firstPage = snapshot(6);
    const appended = snapshot(20);
    expect(
      firstPage.rows.map((row) => Math.round((row.height ?? 0) * 2.625)),
    ).toEqual([189, 190, 189, 190, 189, 190]);
    expect(appended.rows.slice(0, 6)).toEqual(firstPage.rows);
    expect(buildMarketNativeRowPatches(appended, snapshot(20))).toEqual([]);
    expect(rows.every((row) => row.height === 72)).toBe(true);
    const integerDensity = snapshot(6, {
      ...presentation,
      androidPixelRatio: 3,
    });
    expect(integerDensity.rows.map((row) => row.height)).toEqual(
      Array(6).fill(72),
    );
  });

  it('resizes an empty viewport without stretching data or pagination rows', () => {
    const snapshot = (height: number, options = {}) =>
      buildMarketNativeSnapshot({
        rows: [],
        generation: 1,
        presentation,
        loading: false,
        noDataMessage: 'No data',
        retryMessage: 'Retry',
        contentPaddingBottom: 80,
        emptyContentHeight: height,
        ...options,
      });
    const empty = snapshot(500);
    const resized = snapshot(400);
    expect(empty.emptyState?.height).toBe(500);
    expect(resized.emptyState?.height).toBe(400);
    expect(buildMarketNativeRowPatches(empty, resized)).toBeUndefined();
    expect(snapshot(500, { errorMessage: 'No data' }).rows[0]?.height).toBe(
      500,
    );
    expect(snapshot(0, { errorMessage: 'No data' }).rows[0]?.height).toBe(120);
    expect(snapshot(0).emptyState?.height).toBe(88);
    const filteredEmpty = snapshot(0, { emptyContentTopSpacing: 40 });
    expect(filteredEmpty.rows).toEqual([
      {
        key: 'market-empty-spacing',
        height: 40,
        type: 'system',
        variant: 'spacer',
      },
      filteredEmpty.emptyState,
    ]);
    expect(
      snapshot(0, {
        rows: [buildTokenMarketRow({ item: token, presentation })],
        emptyContentTopSpacing: 40,
      }).rows.some((row) => row.key === 'market-empty-spacing'),
    ).toBe(false);
    expect(snapshot(500, { loading: true }).rows[0]?.height).toBe(56);
    const row = buildTokenMarketRow({ item: token, presentation });
    const populated = snapshot(500, { rows: [row], loadMoreError: true });
    expect(populated.rows[0]).toEqual(row);
    expect(populated.rows[1]?.height).toBe(52);
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
      errorMessage: '请求失败',
      noDataMessage: '暂无数据',
      retryMessage: '重试',
      contentPaddingBottom: 20,
    });
    const row = buildTokenMarketRow({ item: token, presentation });
    const loadMore = buildMarketNativeSnapshot({
      rows: [row],
      generation: 3,
      presentation,
      loading: false,
      loadMoreError: true,
      noDataMessage: '暂无数据',
      retryMessage: '重试',
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
    const refreshing = buildMarketNativeSnapshot({
      rows: [row],
      generation: 5,
      presentation,
      loading: false,
      refreshing: true,
      canRefresh: true,
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
      height: 120,
      message: '请求失败',
      actionKey: 'retry',
      actionText: '重试',
    });
    expect(loadMore.rows.at(-1)).toMatchObject({
      type: 'system',
      variant: 'retry',
      height: 52,
      message: '',
      actionKey: 'load-more-retry',
      actionText: '重试',
    });
    expect(end.rows.at(-1)).toMatchObject({
      type: 'system',
      variant: 'end',
    });
    expect(refreshing.capabilities?.refreshing).toBe(true);
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
    const removedBadges = {
      ...previous,
      rows: [{ ...previousRow, badges: [] }],
    };
    const changedBadgeStyle = {
      ...previous,
      rows: [
        {
          ...previousRow,
          badges: previousRow.badges?.map((badge) => ({
            ...badge,
            style: { ...badge.style, height: 20 },
          })),
        },
      ],
    };
    const changedTitleLayout = {
      ...previous,
      rows: [
        {
          ...previousRow,
          style: { ...previousRow.style, titleBadgeGap: 8 },
        },
      ],
    };
    // Native quote updates do not rebind badge views or the title stack.
    expect(
      buildMarketNativeRowPatches(previous, removedBadges),
    ).toBeUndefined();
    expect(
      buildMarketNativeRowPatches(previous, changedBadgeStyle),
    ).toBeUndefined();
    expect(
      buildMarketNativeRowPatches(previous, changedTitleLayout),
    ).toBeUndefined();
    for (const subtitlePrefix of [
      undefined,
      { ...previousRow.subtitlePrefix, text: 'Updated name' },
    ]) {
      expect(
        buildMarketNativeRowPatches(previous, {
          ...previous,
          rows: [{ ...previousRow, subtitlePrefix }],
        }),
      ).toBeUndefined();
    }
  });
});
