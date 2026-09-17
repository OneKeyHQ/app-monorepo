import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import {
  fetchMarketStockKLineData,
  getMarketStockChartInterval,
} from './fetchMarketStockKLineData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarketV2: { fetchMarketStockChart: jest.fn() } },
}));

const serviceMarketV2Mock = backgroundApiProxy.serviceMarketV2 as jest.Mocked<
  typeof backgroundApiProxy.serviceMarketV2
>;

afterEach(() => jest.clearAllMocks());

describe('stock K-line requests', () => {
  it.each([
    ['1', '1min'],
    ['1m', '1min'],
    ['5m', '5min'],
    ['15m', '15min'],
    ['30m', '30min'],
    ['1H', '1hour'],
    ['4H', '4hour'],
    ['1D', '1day'],
    ['1W', '1week'],
    ['1M', '1month'],
  ])('maps %s to the backend interval %s', (interval, expected) => {
    expect(getMarketStockChartInterval(interval)).toBe(expected);
  });

  it.each(['1s', '3m', '2H', '', 'invalid'])(
    'rejects unsupported interval %s',
    (interval) => {
      expect(() => getMarketStockChartInterval(interval)).toThrow(
        'Invalid stock K-line interval',
      );
    },
  );

  it('requests seconds-based history and preserves backend OHLCV without aggregating it', async () => {
    const first = { o: 1, h: 4, l: 0, c: 3, v: 10, t: 1_786_041_000 };
    const second = { o: 3, h: 5, l: 2, c: 4, v: 20, t: 1_786_041_300 };
    serviceMarketV2Mock.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      currency: 'USD',
      interval: '5min',
      points: [
        second,
        first,
        { ...first, t: first.t - 300 },
        { ...second, t: second.t + 300 },
      ],
    });
    const result = await fetchMarketStockKLineData({
      interval: '5m',
      stockId: 'AAPL',
      timeFrom: first.t,
      timeTo: second.t,
    });
    expect(serviceMarketV2Mock.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', interval: '5min', from: first.t, to: second.t }],
    ]);
    expect(result).toEqual({
      pointType: 'ohlc',
      points: [first, second],
      total: 2,
    });
  });

  it('requests successively older ranges without a point limit', async () => {
    const points = Array.from({ length: 601 }, (_, index) => ({
      t: 1_786_041_000 + index * 60,
      o: 1,
      h: 2,
      l: 0,
      c: 1,
      v: 10,
    }));
    serviceMarketV2Mock.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      currency: 'USD',
      points,
    });
    const from = points[0].t;
    const to = points[600].t;
    const result = await fetchMarketStockKLineData({
      interval: '1m',
      stockId: 'AAPL',
      timeFrom: from,
      timeTo: to,
    });
    expect(result.points).toHaveLength(601);
    serviceMarketV2Mock.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      currency: 'USD',
      points: [],
    });
    await fetchMarketStockKLineData({
      interval: '1m',
      stockId: 'AAPL',
      timeFrom: from - 3600,
      timeTo: from - 1,
    });
    expect(serviceMarketV2Mock.fetchMarketStockChart.mock.calls[1]).toEqual([
      { stockId: 'AAPL', interval: '1min', from: from - 3600, to: from - 1 },
    ]);
  });
});
