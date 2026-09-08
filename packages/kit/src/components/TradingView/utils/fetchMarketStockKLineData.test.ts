import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import {
  fetchMarketStockKLineData,
  getMarketStockChartPeriod,
} from './fetchMarketStockKLineData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockChart: jest.fn(),
    },
  },
}));

const serviceMarketV2Mock = backgroundApiProxy.serviceMarketV2 as jest.Mocked<
  typeof backgroundApiProxy.serviceMarketV2
>;

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('getMarketStockChartPeriod', () => {
  it.each([
    ['1', '1h'],
    ['3m', '1h'],
    ['5m', '1d'],
    ['15m', '1d'],
    ['45m', '1d'],
    ['30m', '1w'],
    ['2H', '1w'],
    ['1D', '1y'],
    ['3D', '1y'],
    ['1W', '1y'],
    ['1M', '1y'],
    ['1y', '1y'],
  ] as const)(
    'uses a source period with sufficient resolution for %s candles',
    (interval, period) => {
      expect(getMarketStockChartPeriod({ interval })).toBe(period);
    },
  );

  it('rejects unsupported interval units', () => {
    expect(() => getMarketStockChartPeriod({ interval: '1s' })).toThrow(
      'Invalid stock K-line interval: 1s',
    );
  });
});

describe('fetchMarketStockKLineData', () => {
  it('aggregates source OHLC points into the selected interval', async () => {
    serviceMarketV2Mock.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1d',
      currency: 'USD',
      points: [
        { o: 2.5, h: 4, l: 2, c: 3.5, v: 30, t: 100_600 },
        { o: 1, h: 2, l: 0, c: 1.5, v: 10, t: 100_000 },
        { o: 3.5, h: 5, l: 3, c: 4.5, v: 40, t: 100_900 },
        { o: 1.5, h: 3, l: 1, c: 2.5, v: 20, t: 100_300 },
      ],
    });

    const result = await fetchMarketStockKLineData({
      interval: '15m',
      stockId: 'AAPL',
      timeFrom: 100_000,
      timeTo: 100_899,
    });

    expect(serviceMarketV2Mock.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', period: '1d', points: 500 }],
    ]);
    expect(result).toEqual({
      pointType: 'ohlc',
      points: [{ o: 1, h: 4, l: 0, c: 3.5, v: 60, t: 100_000 }],
      total: 1,
    });
  });

  it('anchors intraday candles to the market session start', async () => {
    const sessionStart = 13 * 60 * 60 + 30 * 60;
    serviceMarketV2Mock.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1w',
      currency: 'USD',
      points: [
        { o: 1, h: 2, l: 0, c: 1.5, v: 10, t: sessionStart },
        {
          o: 1.5,
          h: 3,
          l: 1,
          c: 2.5,
          v: 20,
          t: sessionStart + 30 * 60,
        },
      ],
    });

    await expect(
      fetchMarketStockKLineData({
        interval: '1H',
        stockId: 'AAPL',
        timeFrom: sessionStart,
        timeTo: sessionStart + 60 * 60,
      }),
    ).resolves.toEqual({
      pointType: 'ohlc',
      points: [{ o: 1, h: 3, l: 0, c: 2.5, v: 30, t: sessionStart }],
      total: 1,
    });
    expect(
      serviceMarketV2Mock.fetchMarketStockChart.mock.calls.at(-1)?.[0],
    ).toEqual({
      stockId: 'AAPL',
      period: '1w',
      points: 500,
    });
  });

  it('anchors weekly candles to Monday UTC', async () => {
    const monday = Date.UTC(2026, 7, 24) / 1000;
    serviceMarketV2Mock.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1y',
      currency: 'USD',
      points: [
        { o: 1, h: 2, l: 0, c: 1.5, v: 10, t: monday + 13 * 60 * 60 },
        {
          o: 1.5,
          h: 3,
          l: 1,
          c: 2.5,
          v: 20,
          t: monday + 24 * 60 * 60 + 13 * 60 * 60,
        },
      ],
    });

    await expect(
      fetchMarketStockKLineData({
        interval: '1W',
        stockId: 'AAPL',
        timeFrom: monday,
        timeTo: monday + 7 * 24 * 60 * 60,
      }),
    ).resolves.toEqual({
      pointType: 'ohlc',
      points: [{ o: 1, h: 3, l: 0, c: 2.5, v: 30, t: monday }],
      total: 1,
    });
  });
});
