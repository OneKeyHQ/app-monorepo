import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

import { buildCoinGeckoKLineFallback } from './fetchCoinGeckoKLineFallback';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarket: {
      fetchTokenChart: jest.fn(),
    },
  },
}));

describe('buildCoinGeckoKLineFallback', () => {
  const serviceMarket = backgroundApiProxy.serviceMarket as jest.Mocked<
    typeof backgroundApiProxy.serviceMarket
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('converts legacy CoinGecko points for the TradingView datafeed', async () => {
    serviceMarket.fetchTokenChart.mockResolvedValue([
      [1_000_000_020_000, 1],
      [1_000_000_080_000, 1.1],
    ]);

    const fallback = buildCoinGeckoKLineFallback('stellar');
    const result = await fallback({
      interval: '1',
      networkId: 'coingecko',
      tokenAddress: 'stellar',
      timeFrom: 1_000_000_000,
      timeTo: 1_000_001_000,
    });

    expect(serviceMarket.fetchTokenChart.mock.calls).toEqual([
      ['stellar', '1', { requestCurrency: 'usd' }],
    ]);
    expect(result).toEqual({
      pointType: 'single',
      points: [
        { c: 1, h: 1, l: 1, o: 1, t: 1_000_000_020, v: 0 },
        {
          c: 1.1,
          h: 1.1,
          l: 1.1,
          o: 1.1,
          t: 1_000_000_080,
          v: 0,
        },
      ],
      total: 2,
    });
  });
});
