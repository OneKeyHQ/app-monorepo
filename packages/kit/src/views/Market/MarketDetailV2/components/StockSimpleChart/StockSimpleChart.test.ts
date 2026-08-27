import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { fetchStockSimpleChartPoints } from './stockSimpleChartData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketStockChart: jest.fn(),
      fetchMarketTokenKline: jest.fn(),
    },
  },
}));

describe('fetchStockSimpleChartPoints', () => {
  const serviceMarketV2 = backgroundApiProxy.serviceMarketV2 as jest.Mocked<
    typeof backgroundApiProxy.serviceMarketV2
  >;
  const nowSeconds = 2_000_000_000;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(nowSeconds * 1000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads and trims the one-month share chart from the stock API', async () => {
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1y',
      currency: 'USD',
      points: [
        {
          t: nowSeconds - 200 * 24 * 60 * 60,
          o: 90,
          h: 91,
          l: 89,
          c: 90,
          v: 3,
        },
        {
          t: nowSeconds - 31 * 24 * 60 * 60,
          o: 100,
          h: 101,
          l: 99,
          c: 100,
          v: 1,
        },
        {
          t: nowSeconds - 20 * 24 * 60 * 60,
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
      range: '1M',
      stockId: 'AAPL',
      tokenAddress: '',
    });

    expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', period: '1y', points: 500 }],
    ]);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    // The 30-day window is measured back from the last returned point, not from
    // `now`, so a series that stops 20 days ago still keeps its own tail.
    expect(result).toEqual([
      [nowSeconds - 31 * 24 * 60 * 60, 100],
      [nowSeconds - 20 * 24 * 60 * 60, 101],
    ]);
  });

  it('cuts the one-hour share chart out of the daily series', async () => {
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1d',
      currency: 'USD',
      points: [
        { t: nowSeconds - 4 * 60 * 60, o: 98, h: 99, l: 97, c: 98, v: 1 },
        { t: nowSeconds - 50 * 60, o: 99, h: 100, l: 98, c: 99, v: 2 },
        { t: nowSeconds - 10 * 60, o: 100, h: 101, l: 99, c: 100, v: 3 },
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

    // The share endpoint's own `1h` period currently fails server-side, so 1H
    // asks for the session series and keeps its trailing hour.
    expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toEqual([
      [{ stockId: 'AAPL', period: '1d', points: 500 }],
    ]);
    expect(result).toEqual([
      [nowSeconds - 50 * 60, 99],
      [nowSeconds - 10 * 60, 100],
    ]);
  });

  it('falls back to the untrimmed share series when the window holds one point', async () => {
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1d',
      currency: 'USD',
      points: [
        { t: nowSeconds - 9 * 60 * 60, o: 98, h: 99, l: 97, c: 98, v: 1 },
        { t: nowSeconds - 5 * 60 * 60, o: 99, h: 100, l: 98, c: 99, v: 2 },
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

    expect(result).toEqual([
      [nowSeconds - 9 * 60 * 60, 98],
      [nowSeconds - 5 * 60 * 60, 99],
    ]);
  });

  it('keeps token price mode on the token k-line API', async () => {
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
    expect(serviceMarketV2.fetchMarketStockChart.mock.calls).toHaveLength(0);
    expect(result).toEqual([[nowSeconds - 60, 100]]);
  });
});
