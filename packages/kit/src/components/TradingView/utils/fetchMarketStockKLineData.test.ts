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

describe('getMarketStockChartPeriod', () => {
  const now = 2_000_000;

  it.each([
    [60 * 60, '1h'],
    [24 * 60 * 60, '1d'],
    [7 * 24 * 60 * 60, '1w'],
    [365 * 24 * 60 * 60, '1y'],
    [366 * 24 * 60 * 60, 'all'],
  ] as const)(
    'uses the period that covers a %s-second lookback',
    (age, period) => {
      expect(
        getMarketStockChartPeriod({ now, timeFrom: now - age, timeTo: now }),
      ).toBe(period);
    },
  );
});

describe('fetchMarketStockKLineData', () => {
  it('returns sorted OHLC points within the requested window', async () => {
    serviceMarketV2Mock.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1d',
      currency: 'USD',
      points: [
        { o: 2, h: 3, l: 1, c: 2.5, v: 20, t: 200 },
        { o: 1, h: 2, l: 0.5, c: 1.5, v: 10, t: 100 },
        { o: 3, h: 4, l: 2, c: 3.5, v: 30, t: 300 },
      ],
    });

    const result = await fetchMarketStockKLineData({
      stockId: 'AAPL',
      timeFrom: 100,
      timeTo: 250,
    });

    expect(serviceMarketV2Mock.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', period: 'all', points: 299 }],
    ]);
    expect(result).toEqual({
      pointType: 'ohlc',
      points: [
        { o: 1, h: 2, l: 0.5, c: 1.5, v: 10, t: 100 },
        { o: 2, h: 3, l: 1, c: 2.5, v: 20, t: 200 },
      ],
      total: 2,
    });
  });
});
