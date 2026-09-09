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
      [{ stockId: 'AAPL', period: '1h', points: 100 }],
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

  it('trims the one-month share chart from the latest trading point', async () => {
    const lastTradeSeconds = nowSeconds - 15 * 24 * 60 * 60;
    serviceMarketV2.fetchMarketStockChart.mockResolvedValue({
      stockId: 'AAPL',
      period: '1y',
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
      [{ stockId: 'AAPL', period: '1y', points: 180 }],
    ]);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    expect(result).toEqual([
      [lastTradeSeconds - 20 * 24 * 60 * 60, 101],
      [lastTradeSeconds, 102],
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
          interval: '15m',
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
      interval: '15m',
      timeFrom: nowSeconds - 24 * 60 * 60,
      timeTo: nowSeconds,
      currency: 'usd',
      autoHandleError: false,
    });
    expect(serviceMarket.fetchTokenChart.mock.calls).toHaveLength(0);
    expect(serviceMarketV2.fetchMarketTokenKline.mock.calls).toHaveLength(0);
    expect(result).toEqual([[nowSeconds - 60, 0.08]]);
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
