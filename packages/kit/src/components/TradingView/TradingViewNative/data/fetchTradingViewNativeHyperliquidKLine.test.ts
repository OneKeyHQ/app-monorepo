import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { fetchTradingViewNativeHyperliquidKLine } from './fetchTradingViewNativeHyperliquidKLine';

const globalMockBag = globalThis as typeof globalThis & {
  __tradingViewNativeHyperliquidCandleSnapshot?: jest.Mock;
};

jest.mock('@nktkas/hyperliquid', () => {
  const candleSnapshot = jest.fn();
  (
    globalThis as typeof globalThis & {
      __tradingViewNativeHyperliquidCandleSnapshot?: jest.Mock;
    }
  ).__tradingViewNativeHyperliquidCandleSnapshot = candleSnapshot;

  return {
    HttpTransport: jest.fn(),
    InfoClient: jest.fn(() => ({ candleSnapshot })),
  };
});

function buildCandle(overrides: Partial<ICandle> = {}): ICandle {
  return {
    t: 1_720_000_000_000,
    T: 1_720_014_399_999,
    s: 'BTC',
    i: '4h',
    o: '63000',
    h: '64000',
    l: '62000',
    c: '63500',
    v: '15',
    n: 10,
    ...overrides,
  };
}

describe('TradingViewNative Hyperliquid history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests the raw Hyperliquid ticker and normalizes the response', async () => {
    globalMockBag.__tradingViewNativeHyperliquidCandleSnapshot?.mockResolvedValue(
      [buildCandle(), buildCandle({ c: 'invalid' })],
    );

    await expect(
      fetchTradingViewNativeHyperliquidKLine({
        coin: 'BTC',
        interval: '240',
        timeFrom: 1_720_000_000,
        timeTo: 1_720_014_400,
      }),
    ).resolves.toEqual({
      points: [
        {
          o: 63_000,
          h: 64_000,
          l: 62_000,
          c: 63_500,
          v: 15,
          t: 1_720_000_000,
        },
      ],
      total: 1,
    });
    expect(
      globalMockBag.__tradingViewNativeHyperliquidCandleSnapshot,
    ).toHaveBeenCalledWith(
      {
        coin: 'BTC',
        interval: '4h',
        startTime: 1_720_000_000_000,
        endTime: 1_720_014_400_000,
      },
      undefined,
    );
  });

  it('forwards cancellation to the Hyperliquid client', async () => {
    globalMockBag.__tradingViewNativeHyperliquidCandleSnapshot?.mockResolvedValue(
      [],
    );
    const abortController = new AbortController();

    await fetchTradingViewNativeHyperliquidKLine({
      coin: 'BTC',
      interval: '60',
      timeFrom: 1_720_000_000,
      timeTo: 1_720_003_600,
      signal: abortController.signal,
    });

    expect(
      globalMockBag.__tradingViewNativeHyperliquidCandleSnapshot,
    ).toHaveBeenCalledWith(expect.any(Object), abortController.signal);
  });
});
