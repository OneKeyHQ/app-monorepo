import type { IMarketDetailTicker } from '@onekeyhq/shared/types/market';

import { resolveMarketChartTicker } from './resolveMarketChartTicker';

const ticker: IMarketDetailTicker = {
  localId: 'btc-usdt',
  base: 'BTC',
  target: 'USDT',
  market: {
    name: 'Binance',
    identifier: 'binance',
    has_trading_incentive: false,
  },
  depth_data: null,
  last: 77_600,
  last_updated_at: '2026-09-03T00:00:00Z',
  logo: '',
  volume: 100,
  trust_score: 'green',
  bid_ask_spread_percentage: 0.01,
  trade_url: '',
};

describe('asset modal TradingView ticker', () => {
  it('prioritizes the server-provided TradingView pair', () => {
    const tvPlatform = {
      identifier: 'KRAKEN',
      baseToken: 'BTC',
      targetToken: 'USD',
    };
    expect(
      resolveMarketChartTicker('bitcoin', {
        tvPlatform,
        tickers: [ticker],
        fallbackToChart: false,
      }),
    ).toEqual(tvPlatform);
  });

  it('uses a supported exchange pair for BTC without server TV metadata', () => {
    expect(
      resolveMarketChartTicker('bitcoin', {
        tickers: [ticker],
        fallbackToChart: false,
      }),
    ).toEqual({ identifier: 'binance', baseToken: 'BTC', targetToken: 'USDT' });
  });

  it('normalizes Gate from both identifier and market name', () => {
    for (const identifier of ['gate', 'gate-io']) {
      expect(
        resolveMarketChartTicker('ethereum', {
          fallbackToChart: false,
          tickers: [
            {
              ...ticker,
              base: 'ETH',
              market: { ...ticker.market, identifier, name: 'Gate' },
            },
          ],
        }),
      ).toEqual({
        identifier: 'GATEIO',
        baseToken: 'ETH',
        targetToken: 'USDT',
      });
    }
  });

  it('preserves the stablecoin exchange mappings', () => {
    expect(
      resolveMarketChartTicker('tether', {
        tickers: [ticker],
        fallbackToChart: false,
      }),
    ).toEqual({
      identifier: 'COINBASE',
      baseToken: 'USDT',
      targetToken: 'USD',
    });
    expect(
      resolveMarketChartTicker('usd-coin', {
        tickers: [ticker],
        fallbackToChart: false,
      }),
    ).toEqual({ identifier: 'KRAKEN', baseToken: 'USDC', targetToken: 'USD' });
  });

  it('keeps the app chart when the server requests a fallback', () => {
    expect(
      resolveMarketChartTicker('bitcoin', {
        fallbackToChart: true,
        tickers: [ticker],
        tvPlatform: {
          identifier: 'BINANCE',
          baseToken: 'BTC',
          targetToken: 'USDT',
        },
      }),
    ).toBeUndefined();
  });

  it('does not invent pairs for missing or unsupported market data', () => {
    expect(
      resolveMarketChartTicker('bitcoin', { fallbackToChart: false }),
    ).toBeUndefined();
    expect(
      resolveMarketChartTicker('bitcoin', {
        fallbackToChart: false,
        tickers: [{ ...ticker, target: 'ETH' }],
      }),
    ).toBeUndefined();
    expect(
      resolveMarketChartTicker('bitcoin', {
        fallbackToChart: false,
        tickers: [
          {
            ...ticker,
            market: {
              ...ticker.market,
              identifier: 'unknown',
              name: 'Unknown',
            },
          },
        ],
      }),
    ).toBeUndefined();
  });
});
