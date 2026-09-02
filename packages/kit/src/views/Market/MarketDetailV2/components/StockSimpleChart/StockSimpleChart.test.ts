import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import {
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  TOKEN_SIMPLE_CHART_RANGES,
  fetchStockSimpleChartPoints,
  resolveStockSimpleChartRequestScope,
} from './stockSimpleChartData';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchTokenChart: jest.fn(),
    },
    serviceMarketV2: {
      fetchMarketStockChart: jest.fn(),
      fetchMarketTokenKline: jest.fn(),
    },
  },
}));

describe('fetchStockSimpleChartPoints', () => {
  const serviceMarket = backgroundApiProxy.serviceMarket as jest.Mocked<
    typeof backgroundApiProxy.serviceMarket
  >;
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
      [{ stockId: 'AAPL', period: '1y', points: 180 }],
    ]);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    expect(result).toEqual([[nowSeconds - 20 * 24 * 60 * 60, 101]]);
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
          interval: '15m',
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

  it('normalizes a stale token All range to a bounded one-year request', async () => {
    serviceMarketV2.fetchMarketTokenKline.mockResolvedValue({
      total: 0,
      points: [],
    });

    await fetchStockSimpleChartPoints({
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'token',
      range: 'All',
      stockId: 'AAPL',
      tokenAddress: '0xaapl',
    });

    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toEqual([
      [
        {
          interval: '1D',
          networkId: 'evm--1',
          tokenAddress: '0xaapl',
          timeFrom: nowSeconds - 365 * 24 * 60 * 60,
          timeTo: nowSeconds,
          autoHandleError: false,
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
      [{ stockId: 'AAPL', period: 'all', points: 100 }],
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
  it('exposes All only for the share data source', () => {
    expect(TOKEN_SIMPLE_CHART_RANGES).not.toContain('All');
    expect(STOCK_SHARE_SIMPLE_CHART_RANGES).toContain('All');
  });

  it('ignores token variants while showing share prices', () => {
    const firstVariant = resolveStockSimpleChartRequestScope({
      coinGeckoId: 'first',
      isNative: false,
      networkId: 'evm--1',
      priceMode: 'share',
      range: '1D',
      stockId: 'AAPL',
      tokenAddress: '0xfirst',
    });
    const secondVariant = resolveStockSimpleChartRequestScope({
      coinGeckoId: 'second',
      isNative: false,
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
