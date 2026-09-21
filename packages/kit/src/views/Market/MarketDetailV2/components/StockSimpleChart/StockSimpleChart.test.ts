import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';

import {
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  STOCK_SIMPLE_CHART_POLLING_MS,
  TOKEN_SIMPLE_CHART_RANGES,
  buildStockSimpleChartScopeKey,
  clipStockSimpleChartToActiveRange,
  fetchStockSimpleChartPoints,
  mergeStockSimpleChartLivePrice,
  resolveStockSimpleChartActiveRangeStartSeconds,
  resolveStockSimpleChartBucketSeconds,
  resolveStockSimpleChartClipKey,
  resolveStockSimpleChartDisplayPoints,
  resolveStockSimpleChartLivePrice,
  resolveStockSimpleChartMinRefreshMs,
  resolveStockSimpleChartPreviousClose,
  resolveStockSimpleChartPulseLastPoint,
  resolveStockSimpleChartRequestScope,
  shouldStoreStockSimpleChartSeries,
} from './stockSimpleChartData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchMarketAssetKline: jest.fn(),
      fetchTokenChart: jest.fn(),
    },
    serviceMarketV2: {
      fetchMarketStockChart: jest.fn(),
      fetchMarketTokenKline: jest.fn(),
    },
    serviceToken: {
      fetchTokenInfoOnly: jest.fn(),
    },
  },
}));

describe('fetchStockSimpleChartPoints', () => {
  const serviceMarket = backgroundApiProxy.serviceMarket as jest.Mocked<
    typeof backgroundApiProxy.serviceMarket
  >;
  const serviceMarketAsset = backgroundApiProxy.serviceMarket as unknown as {
    fetchMarketAssetKline: jest.Mock;
  };
  const serviceMarketV2 = backgroundApiProxy.serviceMarketV2 as jest.Mocked<
    typeof backgroundApiProxy.serviceMarketV2
  >;
  const serviceToken = backgroundApiProxy.serviceToken as jest.Mocked<
    typeof backgroundApiProxy.serviceToken
  >;
  const nowSeconds = 2_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['1H', '1h'],
    ['1D', '1d'],
    ['1W', '1w'],
    ['1M', '1m'],
    ['1Y', '1y'],
    ['All', 'all'],
  ] as const)(
    'requests %s without limiting or truncating points',
    async (range, period) => {
      const points = Array.from({ length: 601 }, (_, index) => ({
        t: nowSeconds - (601 - index) * 86_400,
        o: 100,
        h: 102,
        l: 99,
        c: 101,
        v: 1,
      }));
      serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
        stockId: 'AAPL',
        period,
        currency: 'USD',
        points,
      });
      const result = await fetchStockSimpleChartPoints({
        isNative: false,
        networkId: '',
        priceMode: 'share',
        range,
        stockId: 'AAPL',
        tokenAddress: '',
      });
      expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toEqual([
        [{ stockId: 'AAPL', period }],
      ]);
      expect(result).toEqual(points.map((point) => [point.t, point.c]));
    },
  );

  it('keeps the latest trading hour after the stock market closes', async () => {
    const lastTradeSeconds = nowSeconds - 12 * 60 * 60;
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1h',
      currency: 'USD',
      points: [
        {
          t: lastTradeSeconds - 30 * 60,
          o: 100,
          h: 101,
          l: 99,
          c: 100,
          v: 1,
        },
        {
          t: lastTradeSeconds,
          o: 101,
          h: 102,
          l: 100,
          c: 101,
          v: 2,
        },
      ],
    });

    const result = await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: '',
      priceMode: 'share',
      range: '1H',
      stockId: 'AAPL',
      tokenAddress: '',
    });

    expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', period: '1h' }],
    ]);
    expect(result).toEqual([
      [lastTradeSeconds - 30 * 60, 100],
      [lastTradeSeconds, 101],
    ]);
  });

  it('keeps the latest trading day over a weekend', async () => {
    const lastTradeSeconds = nowSeconds - 2 * 24 * 60 * 60;
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1d',
      currency: 'USD',
      points: [
        {
          t: lastTradeSeconds,
          o: 100,
          h: 102,
          l: 99,
          c: 101,
          v: 1,
        },
      ],
    });

    const result = await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: '',
      priceMode: 'share',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '',
    });

    expect(result).toEqual([[lastTradeSeconds, 101]]);
  });

  it('keeps every returned point in the one-month share chart', async () => {
    const lastTradeSeconds = nowSeconds - 15 * 24 * 60 * 60;
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1m',
      currency: 'USD',
      points: [
        {
          t: lastTradeSeconds - 31 * 24 * 60 * 60,
          o: 100,
          h: 101,
          l: 99,
          c: 100,
          v: 1,
        },
        {
          t: lastTradeSeconds - 20 * 24 * 60 * 60,
          o: 101,
          h: 102,
          l: 100,
          c: 101,
          v: 2,
        },
        {
          t: lastTradeSeconds,
          o: 102,
          h: 103,
          l: 101,
          c: 102,
          v: 3,
        },
      ],
    });

    const result = await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: '',
      priceMode: 'share',
      range: '1M',
      stockId: 'AAPL',
      tokenAddress: '',
    });

    expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', period: '1m' }],
    ]);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    expect(result).toEqual([
      [lastTradeSeconds - 31 * 24 * 60 * 60, 100],
      [lastTradeSeconds - 20 * 24 * 60 * 60, 101],
      [lastTradeSeconds, 102],
    ]);
  });

  it('fills the buckets the token k-line feed skipped', async () => {
    const t = nowSeconds - 60 * 60;
    serviceMarketV2.fetchMarketTokenKline.mockResolvedValue({
      total: 3,
      points: [
        { t, o: 10, h: 10, l: 10, c: 10, v: 0 },
        { t: t + 900, o: 12, h: 12, l: 12, c: 12, v: 0 },
        { t: t + 1200, o: 11, h: 11, l: 11, c: 11, v: 0 },
      ],
    });

    const result = await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'token',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
    });

    // 1D asks for 5m buckets; the two the feed skipped carry the last close so
    // the chart's even point spacing still matches elapsed time.
    expect(result).toEqual([
      [t, 10],
      [t + 300, 10],
      [t + 600, 10],
      [t + 900, 12],
      [t + 1200, 11],
    ]);
  });

  it('keeps bounded token ranges on the token k-line API', async () => {
    serviceMarketV2.fetchMarketTokenKline.mockResolvedValue({
      total: 1,
      points: [
        {
          t: nowSeconds - 60,
          o: 100,
          h: 101,
          l: 99,
          c: 100,
          v: 1,
        },
      ],
    });

    const result = await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'token',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
    });

    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toEqual([
      [
        {
          interval: '5m',
          networkId: 'evm--1',
          tokenAddress: '0xaapl',
          timeFrom: nowSeconds - 24 * 60 * 60,
          timeTo: nowSeconds,
          autoHandleError: false,
        },
      ],
    ]);
    expect(serviceMarket.fetchTokenChart.mock.calls).toHaveLength(0);
    expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toHaveLength(0);
    expect(result).toEqual([[nowSeconds - 60, 100]]);
  });

  it('loads Top Coins from the self-maintained Asset K-line API', async () => {
    serviceMarketAsset.fetchMarketAssetKline.mockResolvedValue({
      pointType: 'single',
      total: 1,
      points: [
        {
          t: nowSeconds - 60,
          o: 0.08,
          h: 0.08,
          l: 0.08,
          c: 0.08,
          v: 0,
        },
      ],
    });

    const result = await fetchStockSimpleChartPoints({
      isNative: true,
      marketAssetId: 'doge',
      networkId: 'doge--0',
      priceMode: 'token',
      range: '1D',
      tokenAddress: '',
    });

    expect(serviceMarketAsset.fetchMarketAssetKline).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '5m',
      // Five minutes short of a day: at a full 86400s window the endpoint
      // ignores `interval` and answers with hourly buckets.
      timeFrom: nowSeconds - (24 * 60 * 60 - 5 * 60),
      timeTo: nowSeconds,
      currency: 'usd',
      autoHandleError: false,
    });
    expect(serviceMarket.fetchTokenChart.mock.calls).toHaveLength(0);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    expect(result).toEqual([[nowSeconds - 60, 0.08]]);
  });

  it('asks the Asset K-line API for its finest served interval on 1H', async () => {
    serviceMarketAsset.fetchMarketAssetKline.mockResolvedValue({
      pointType: 'single',
      total: 0,
      points: [],
    });

    await fetchStockSimpleChartPoints({
      isNative: true,
      marketAssetId: 'doge',
      networkId: 'doge--0',
      priceMode: 'token',
      range: '1H',
      tokenAddress: '',
    });

    expect(serviceMarketAsset.fetchMarketAssetKline).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '5m',
      timeFrom: nowSeconds - 60 * 60,
      timeTo: nowSeconds,
      currency: 'usd',
      autoHandleError: false,
    });
  });

  it('leaves the DEX token K-line intervals untouched', async () => {
    serviceMarketV2.fetchMarketTokenKline.mockResolvedValue({
      total: 0,
      points: [],
    });

    await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'token',
      range: '1H',
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
    });

    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toEqual([
      [
        {
          interval: '1m',
          networkId: 'evm--1',
          tokenAddress: '0xaapl',
          timeFrom: nowSeconds - 60 * 60,
          timeTo: nowSeconds,
          autoHandleError: false,
        },
      ],
    ]);
  });

  it('requests complete Top Coins history without a CoinGecko lookup', async () => {
    serviceMarketAsset.fetchMarketAssetKline.mockResolvedValue({
      pointType: 'single',
      total: 0,
      points: [],
    });

    await fetchStockSimpleChartPoints({
      isNative: true,
      marketAssetId: 'doge',
      networkId: 'doge--0',
      priceMode: 'token',
      range: 'All',
      tokenAddress: '',
    });

    expect(serviceMarketAsset.fetchMarketAssetKline).toHaveBeenCalledWith({
      assetId: 'doge',
      interval: '1W',
      timeFrom: undefined,
      timeTo: undefined,
      currency: 'usd',
      autoHandleError: false,
    });
    expect(serviceToken.fetchTokenInfoOnly.mock.calls).toHaveLength(0);
    expect(serviceMarket.fetchTokenChart.mock.calls).toHaveLength(0);
  });

  it('loads the complete native-token history by its CoinGecko ID', async () => {
    serviceToken.fetchTokenInfoOnly.mockResolvedValue({
      info: { coingeckoId: 'bitcoin' },
    } as Awaited<ReturnType<typeof serviceToken.fetchTokenInfoOnly>>);
    serviceMarket.fetchTokenChart.mockResolvedValue([
      [(nowSeconds - 60) * 1000, 78_432],
    ]);

    const result = await fetchStockSimpleChartPoints({
      isNative: true,
      networkId: 'btc--0',
      priceMode: 'token',
      range: 'All',
      tokenAddress: '',
    });

    expect(serviceMarket.fetchTokenChart.mock.calls).toEqual([
      [
        'bitcoin',
        'max',
        {
          requestCurrency: 'usd',
        },
      ],
    ]);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    expect(result).toEqual([[nowSeconds - 60, 78_432]]);
  });

  it('falls back to the token identity when no CoinGecko ID exists', async () => {
    serviceToken.fetchTokenInfoOnly.mockResolvedValue({
      info: {},
    } as Awaited<ReturnType<typeof serviceToken.fetchTokenInfoOnly>>);
    serviceMarket.fetchTokenChart.mockResolvedValue([
      [(nowSeconds - 60) * 1000, 1],
    ]);

    await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'token',
      range: 'All',
      tokenAddress: '0xtoken',
    });

    expect(serviceMarket.fetchTokenChart.mock.calls).toEqual([
      [
        undefined,
        'max',
        {
          networkId: 'evm--1',
          requestCurrency: 'usd',
          tokenAddress: '0xtoken',
        },
      ],
    ]);
  });

  it('keeps All available for the stock share data source', async () => {
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: 'all',
      currency: 'USD',
      points: [],
    });

    await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'share',
      range: 'All',
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
    });

    expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', period: 'all' }],
    ]);
  });

  it('uses CoinGecko chart data when V2 detail is unsupported', async () => {
    serviceMarket.fetchTokenChart.mockResolvedValue([
      [(nowSeconds - 2 * 24 * 60 * 60) * 1000, 80],
      [(nowSeconds - 60) * 1000, 84],
    ]);

    const result = await fetchStockSimpleChartPoints({
      coinGeckoId: 'hyperliquid',
      isNative: true,
      networkId: 'evm--999',
      priceMode: 'token',
      range: '1D',
      tokenAddress: '',
    });

    expect(serviceMarket.fetchTokenChart.mock.calls).toEqual([
      ['hyperliquid', '1', { requestCurrency: 'usd' }],
    ]);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    expect(result).toEqual([[nowSeconds - 60, 84]]);
  });
});

describe('stock simple chart request identity', () => {
  it('exposes All for both token and share data sources', () => {
    expect(TOKEN_SIMPLE_CHART_RANGES).toContain('All');
    expect(STOCK_SHARE_SIMPLE_CHART_RANGES).toContain('All');
  });

  it('ignores token variants while showing share prices', () => {
    const firstVariant = resolveStockSimpleChartRequestScope({
      coinGeckoId: 'first',
      isNative: false,
      marketAssetId: 'aapl',
      networkId: 'evm--1',
      priceMode: 'share',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '0xfirst',
    });
    const secondVariant = resolveStockSimpleChartRequestScope({
      coinGeckoId: 'second',
      isNative: false,
      marketAssetId: 'aapl',
      networkId: 'evm--8453',
      priceMode: 'share',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '0xsecond',
    });

    expect(secondVariant).toEqual(firstVariant);
  });

  it('keeps token variants in token-price request identity', () => {
    const firstVariant = resolveStockSimpleChartRequestScope({
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'token',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '0xfirst',
    });
    const secondVariant = resolveStockSimpleChartRequestScope({
      isNative: false,
      networkId: 'evm--8453',
      priceMode: 'token',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '0xsecond',
    });

    expect(secondVariant).not.toEqual(firstVariant);
  });
});

describe('resolveStockSimpleChartPreviousClose', () => {
  const stockDetail = { previousClose: '328.21' };

  it('frames the intraday share ranges with the reported previous close', () => {
    expect(
      resolveStockSimpleChartPreviousClose({
        priceMode: 'share',
        range: '1D',
        stockDetail,
      }),
    ).toBe(328.21);
    expect(
      resolveStockSimpleChartPreviousClose({
        priceMode: 'share',
        range: '1H',
        stockDetail,
      }),
    ).toBe(328.21);
  });

  it('stays off for longer ranges, token price mode, and missing quotes', () => {
    for (const range of ['1W', '1M', '1Y', 'All'] as const) {
      expect(
        resolveStockSimpleChartPreviousClose({
          priceMode: 'share',
          range,
          stockDetail,
        }),
      ).toBeUndefined();
    }
    expect(
      resolveStockSimpleChartPreviousClose({
        priceMode: 'token',
        range: '1D',
        stockDetail,
      }),
    ).toBeUndefined();
    expect(
      resolveStockSimpleChartPreviousClose({
        priceMode: 'share',
        range: '1D',
        stockDetail: undefined,
      }),
    ).toBeUndefined();
    expect(
      resolveStockSimpleChartPreviousClose({
        priceMode: 'share',
        range: '1D',
        stockDetail: { previousClose: '' },
      }),
    ).toBeUndefined();
  });
});

describe('resolveStockSimpleChartPulseLastPoint', () => {
  it('always pulses crypto, which trades around the clock', () => {
    expect(resolveStockSimpleChartPulseLastPoint({})).toBe(true);
    expect(
      resolveStockSimpleChartPulseLastPoint({
        stockDetail: null,
        tokenStock: null,
      }),
    ).toBe(true);
  });

  it('pulses a stock only while its market is open', () => {
    expect(
      resolveStockSimpleChartPulseLastPoint({
        stockId: 'AAPL',
        stockDetail: { marketStatus: { isOpen: true } },
      }),
    ).toBe(true);
    expect(
      resolveStockSimpleChartPulseLastPoint({
        stockId: 'AAPL',
        stockDetail: { marketStatus: { isOpen: false } },
      }),
    ).toBe(false);
    expect(resolveStockSimpleChartPulseLastPoint({ stockId: 'AAPL' })).toBe(
      false,
    );
    expect(
      resolveStockSimpleChartPulseLastPoint({ tokenStock: { isOpen: true } }),
    ).toBe(true);
    expect(
      resolveStockSimpleChartPulseLastPoint({ tokenStock: { isOpen: false } }),
    ).toBe(false);
  });
});

describe('resolveStockSimpleChartLivePrice', () => {
  it('uses the same quote the title reads in each price mode', () => {
    expect(
      resolveStockSimpleChartLivePrice({
        priceMode: 'token',
        stockDetail: { price: '334.76' },
        tokenDetail: { price: '332.41' },
      }),
    ).toBe('332.41');
    expect(
      resolveStockSimpleChartLivePrice({
        priceMode: 'share',
        stockDetail: { price: '334.76' },
        tokenDetail: { price: '332.41' },
      }),
    ).toBe('334.76');
  });
});

describe('resolveStockSimpleChartBucketSeconds', () => {
  it('uses the 5m asset buckets shown on an AAPL 1H simple chart', () => {
    expect(
      resolveStockSimpleChartBucketSeconds({
        marketAssetId: 'aapl',
        priceMode: 'token',
        range: '1H',
      }),
    ).toBe(5 * 60);
  });

  it('leaves share and All-range CoinGecko series without a fixed bucket', () => {
    expect(
      resolveStockSimpleChartBucketSeconds({
        priceMode: 'share',
        range: '1H',
      }),
    ).toBeUndefined();
    expect(
      resolveStockSimpleChartBucketSeconds({
        priceMode: 'token',
        range: 'All',
      }),
    ).toBeUndefined();
  });
});

describe('mergeStockSimpleChartLivePrice', () => {
  const fiveMinutes = 5 * 60;
  const closedBucket = 1_725_000_000;
  const openBucket = closedBucket + fiveMinutes;
  const nowSeconds = openBucket + 120;
  const points: IMarketTokenChart = [
    [closedBucket, 331.2],
    [openBucket, 334.76],
  ];

  it('drops the open 5m cutoff and appends one live point at now', () => {
    expect(
      mergeStockSimpleChartLivePrice({
        intervalSeconds: fiveMinutes,
        livePrice: '332.41',
        nowSeconds,
        points,
      }),
    ).toEqual([
      [closedBucket, 331.2],
      [nowSeconds, 332.41],
    ]);
  });

  it('does not rewrite a closed 5m cutoff', () => {
    const closedPoints: IMarketTokenChart = [
      [closedBucket - fiveMinutes, 330],
      [closedBucket, 334.76],
    ];
    const now = closedBucket + fiveMinutes + 30;

    expect(
      mergeStockSimpleChartLivePrice({
        intervalSeconds: fiveMinutes,
        livePrice: '332.41',
        nowSeconds: now,
        points: closedPoints,
      }),
    ).toEqual([
      [closedBucket - fiveMinutes, 330],
      [closedBucket, 334.76],
      [now, 332.41],
    ]);
  });

  it('still pins a stale last-session 1H series to the title quote', () => {
    const now = closedBucket + 8 * 60 * 60;
    expect(
      mergeStockSimpleChartLivePrice({
        intervalSeconds: fiveMinutes,
        livePrice: '332.41',
        nowSeconds: now,
        points: [[closedBucket, 334.76]],
      }),
    ).toEqual([
      [closedBucket, 334.76],
      [now, 332.41],
    ]);
  });

  it('drops a clock-ahead last bar and appends the live point at now', () => {
    expect(
      mergeStockSimpleChartLivePrice({
        intervalSeconds: 60,
        livePrice: '0.0000653',
        nowSeconds: closedBucket,
        points: [
          [closedBucket - 60, 0.000_064_5],
          [closedBucket + 60, 0.000_064_59],
        ],
      }),
    ).toEqual([
      [closedBucket - 60, 0.000_064_5],
      [closedBucket, 0.000_065_3],
    ]);
  });

  it('drops every clock-ahead tail bar, not just the last one', () => {
    expect(
      mergeStockSimpleChartLivePrice({
        intervalSeconds: 60,
        livePrice: '0.0000653',
        nowSeconds: closedBucket,
        points: [
          [closedBucket - 120, 0.000_064_4],
          [closedBucket - 60, 0.000_064_5],
          [closedBucket + 60, 0.000_064_59],
          [closedBucket + 120, 0.000_064_6],
          [closedBucket + 180, 0.000_064_7],
        ],
      }),
    ).toEqual([
      [closedBucket - 120, 0.000_064_4],
      [closedBucket - 60, 0.000_064_5],
      [closedBucket, 0.000_065_3],
    ]);
  });

  it('appends a live point on All-range series without a bucket width', () => {
    expect(
      mergeStockSimpleChartLivePrice({
        livePrice: '332.41',
        nowSeconds: closedBucket + 60,
        points: [[closedBucket, 334.76]],
      }),
    ).toEqual([
      [closedBucket, 334.76],
      [closedBucket + 60, 332.41],
    ]);
  });

  it('leaves empty or invalid live quotes untouched', () => {
    expect(
      mergeStockSimpleChartLivePrice({
        livePrice: '332.41',
        nowSeconds,
        points: [],
      }),
    ).toEqual([]);
    expect(
      mergeStockSimpleChartLivePrice({
        livePrice: 'n/a',
        nowSeconds,
        points,
      }),
    ).toBe(points);
  });
});

describe('clipStockSimpleChartToActiveRange', () => {
  // Monday 2026-09-21 04:18 EDT — ~17 minutes into US pre-market.
  const mondayPremarketNow = Date.parse('2026-09-21T08:18:00Z') / 1000;
  const fridayLastHour = Date.parse('2026-09-18T19:30:00Z') / 1000;
  const fridayClose = Date.parse('2026-09-18T20:00:00Z') / 1000;
  const mondayPremarketOpen = Date.parse('2026-09-21T08:05:00Z') / 1000;
  const mondayPremarketLater = Date.parse('2026-09-21T08:10:00Z') / 1000;
  // Saturday 2026-09-19 10:00 EDT — weekend, last session must stay on screen.
  const saturdayNow = Date.parse('2026-09-19T14:00:00Z') / 1000;

  it('drops last Friday prints once Monday pre-market is open', () => {
    const points: IMarketTokenChart = [
      [fridayLastHour, 221],
      [fridayClose, 222],
      [mondayPremarketOpen, 223.1],
      [mondayPremarketLater, 223.4],
    ];

    expect(
      clipStockSimpleChartToActiveRange({
        nowSeconds: mondayPremarketNow,
        points,
        priceMode: 'share',
        range: '1D',
      }),
    ).toEqual([
      [mondayPremarketOpen, 223.1],
      [mondayPremarketLater, 223.4],
    ]);
    expect(
      resolveStockSimpleChartActiveRangeStartSeconds({
        nowSeconds: mondayPremarketNow,
        priceMode: 'share',
        range: '1H',
      }),
    ).toBe(mondayPremarketNow - 60 * 60);
  });

  it('keeps last Friday on the weekend, when the market is closed', () => {
    const points: IMarketTokenChart = [
      [fridayLastHour, 221],
      [fridayClose, 222],
    ];

    expect(
      clipStockSimpleChartToActiveRange({
        nowSeconds: saturdayNow,
        points,
        priceMode: 'share',
        range: '1D',
      }),
    ).toBe(points);
    expect(
      resolveStockSimpleChartActiveRangeStartSeconds({
        nowSeconds: saturdayNow,
        priceMode: 'share',
        range: '1D',
      }),
    ).toBeUndefined();
  });

  it('does not clip longer ranges that are supposed to span sessions', () => {
    const points: IMarketTokenChart = [
      [fridayClose, 222],
      [mondayPremarketLater, 223.4],
    ];

    expect(
      clipStockSimpleChartToActiveRange({
        nowSeconds: mondayPremarketNow,
        points,
        priceMode: 'share',
        range: '1W',
      }),
    ).toBe(points);
  });

  it('does not clip token series', () => {
    expect(
      resolveStockSimpleChartActiveRangeStartSeconds({
        nowSeconds: mondayPremarketNow,
        priceMode: 'token',
        range: '1H',
      }),
    ).toBeUndefined();
  });

  it('keeps last session on a weekday holiday when the backend is closed', () => {
    // Thursday 2026-09-17 11:00 EDT — clock says regular session.
    const holidayNow = Date.parse('2026-09-17T15:00:00Z') / 1000;
    expect(
      resolveStockSimpleChartActiveRangeStartSeconds({
        isOpen: false,
        nowSeconds: holidayNow,
        priceMode: 'share',
        range: '1H',
      }),
    ).toBeUndefined();
  });

  it('still clips through the Monday opening-cross gap', () => {
    // Monday 2026-09-21 09:30:30 EDT — 09:30 opening cross.
    const openingCrossNow = Date.parse('2026-09-21T13:30:30Z') / 1000;
    expect(
      resolveStockSimpleChartClipKey({
        isOpen: false,
        nowSeconds: openingCrossNow,
        priceMode: 'share',
        range: '1D',
      }),
    ).toBe('clip');
    expect(
      clipStockSimpleChartToActiveRange({
        isOpen: false,
        nowSeconds: openingCrossNow,
        points: [
          [fridayClose, 222],
          [mondayPremarketLater, 223.4],
        ],
        priceMode: 'share',
        range: '1D',
      }),
    ).toEqual([[mondayPremarketLater, 223.4]]);
  });
});

describe('resolveStockSimpleChartDisplayPoints', () => {
  const mondayPremarketNow = Date.parse('2026-09-21T08:18:00Z') / 1000;
  const fridayClose = Date.parse('2026-09-18T20:00:00Z') / 1000;
  const mondayPremarketOpen = Date.parse('2026-09-21T08:05:00Z') / 1000;

  it('does not draw Friday→Monday as one horizontal 1D segment', () => {
    expect(
      resolveStockSimpleChartDisplayPoints({
        livePrice: '223.58',
        nowSeconds: mondayPremarketNow,
        points: [
          [fridayClose, 222],
          [mondayPremarketOpen, 223.1],
        ],
        priceMode: 'share',
        range: '1D',
      }),
    ).toEqual([
      [mondayPremarketOpen, 223.1],
      [mondayPremarketNow, 223.58],
    ]);
  });

  it('pins a lone live point when last session is the only history', () => {
    expect(
      resolveStockSimpleChartDisplayPoints({
        livePrice: '223.58',
        nowSeconds: mondayPremarketNow,
        points: [[fridayClose, 222]],
        priceMode: 'share',
        range: '1H',
      }),
    ).toEqual([[mondayPremarketNow, 223.58]]);
  });

  it('keeps last-session history until a live quote exists', () => {
    const points: IMarketTokenChart = [[fridayClose, 222]];
    expect(
      resolveStockSimpleChartDisplayPoints({
        livePrice: undefined,
        nowSeconds: mondayPremarketNow,
        points,
        priceMode: 'share',
        range: '1H',
      }),
    ).toBe(points);
  });
});

describe('shouldStoreStockSimpleChartSeries', () => {
  const baseParams = {
    currentScopeKey: 'token|1D|evm--1|0xabc|||',
    requestScopeKey: 'token|1D|evm--1|0xabc|||',
    requestSeq: 2,
    storedSeq: 1,
  };

  it('stores a newer response for the current scope', () => {
    expect(shouldStoreStockSimpleChartSeries(baseParams)).toBe(true);
  });

  it('stores the first response of a session', () => {
    expect(
      shouldStoreStockSimpleChartSeries({
        ...baseParams,
        requestSeq: 1,
        storedSeq: undefined,
      }),
    ).toBe(true);
  });

  // Two refreshes of one scope can overlap and answer out of order; the older
  // one must not restore its series over the newer one.
  it('drops a response overtaken by a later request', () => {
    expect(
      shouldStoreStockSimpleChartSeries({
        ...baseParams,
        requestSeq: 2,
        storedSeq: 3,
      }),
    ).toBe(false);
  });

  it('drops a response whose scope the user has left', () => {
    expect(
      shouldStoreStockSimpleChartSeries({
        ...baseParams,
        currentScopeKey: 'token|1W|evm--1|0xabc|||',
      }),
    ).toBe(false);
  });
});

describe('resolveStockSimpleChartMinRefreshMs', () => {
  it('refetches fine-bucket ranges more often than coarse ones', () => {
    const oneHour = resolveStockSimpleChartMinRefreshMs({ range: '1H' });
    const oneYear = resolveStockSimpleChartMinRefreshMs({ range: '1Y' });
    expect(oneHour).toBeLessThan(oneYear);
  });

  it('keeps every range on a positive floor', () => {
    for (const range of TOKEN_SIMPLE_CHART_RANGES) {
      expect(resolveStockSimpleChartMinRefreshMs({ range })).toBeGreaterThan(0);
    }
  });

  // A per-range pollingInterval would make usePromiseResult withhold the
  // dependency-triggered run for the full new duration on every range switch.
  it('paces ranges without varying the polling interval', () => {
    expect(STOCK_SIMPLE_CHART_POLLING_MS).toBeGreaterThan(0);
    const floors = TOKEN_SIMPLE_CHART_RANGES.map((range) =>
      resolveStockSimpleChartMinRefreshMs({ range }),
    );
    expect(Math.min(...floors)).toBeGreaterThanOrEqual(
      STOCK_SIMPLE_CHART_POLLING_MS,
    );
  });
});

describe('buildStockSimpleChartScopeKey', () => {
  const baseScope = {
    networkId: 'evm--4663',
    priceMode: 'token' as const,
    range: '1D' as const,
    tokenAddress: '0xabc',
  };

  it('matches itself for an unchanged scope', () => {
    expect(buildStockSimpleChartScopeKey(baseScope)).toBe(
      buildStockSimpleChartScopeKey(baseScope),
    );
  });

  it('separates a different range, token, network or price mode', () => {
    const key = buildStockSimpleChartScopeKey(baseScope);
    expect(
      buildStockSimpleChartScopeKey({ ...baseScope, range: '1W' }),
    ).not.toBe(key);
    expect(
      buildStockSimpleChartScopeKey({ ...baseScope, tokenAddress: '0xdef' }),
    ).not.toBe(key);
    expect(
      buildStockSimpleChartScopeKey({ ...baseScope, networkId: 'evm--56' }),
    ).not.toBe(key);
    expect(
      buildStockSimpleChartScopeKey({ ...baseScope, priceMode: 'share' }),
    ).not.toBe(key);
  });

  it('separates series that only differ by their upstream id', () => {
    const key = buildStockSimpleChartScopeKey(baseScope);
    expect(
      buildStockSimpleChartScopeKey({ ...baseScope, stockId: 'AAPL' }),
    ).not.toBe(key);
    expect(
      buildStockSimpleChartScopeKey({ ...baseScope, marketAssetId: 'bitcoin' }),
    ).not.toBe(key);
    expect(
      buildStockSimpleChartScopeKey({ ...baseScope, coinGeckoId: 'bitcoin' }),
    ).not.toBe(key);
  });
});
