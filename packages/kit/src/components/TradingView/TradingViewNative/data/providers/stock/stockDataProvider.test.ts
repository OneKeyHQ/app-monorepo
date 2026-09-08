import { fetchMarketStockKLineData } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData';

import { createTradingViewNativeStockDataProvider } from './stockDataProvider';

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketStockKLineData',
  () => ({ fetchMarketStockKLineData: jest.fn() }),
);

const fetchMarketStockKLineDataMock = jest.mocked(fetchMarketStockKLineData);

describe('createTradingViewNativeStockDataProvider', () => {
  it('uses stock history without enabling token realtime updates', async () => {
    fetchMarketStockKLineDataMock.mockResolvedValue({
      pointType: 'ohlc',
      points: [{ o: 1, h: 2, l: 0.5, c: 1.5, v: 10, t: 100 }],
      total: 1,
    });
    const provider = createTradingViewNativeStockDataProvider({
      kind: 'stock',
      stockId: 'AAPL',
    });
    const signal = new AbortController().signal;
    const interval = {
      label: '1H',
      value: '60',
      seconds: 3600,
      marketWsValue: '1h',
      hyperliquidValue: '1h',
    } as const;

    await expect(
      provider.fetchHistory({
        interval,
        signal,
        timeFrom: 100,
        timeTo: 200,
      }),
    ).resolves.toEqual({
      pointType: 'ohlc',
      points: [{ o: 1, h: 2, l: 0.5, c: 1.5, v: 10, t: 100 }],
      total: 1,
    });
    expect(fetchMarketStockKLineDataMock.mock.calls).toEqual([
      [{ interval: '1H', stockId: 'AAPL', timeFrom: 100, timeTo: 200 }],
    ]);
    expect(provider.key).toBe('stock:AAPL');
    expect(provider.isReady).toBe(true);
    expect(provider.supportsRealtime).toBe(false);
    expect(provider.getHistoryRequestCandleCount(interval)).toBe(100);
    expect(provider.hasMoreHistory({ interval, receivedPointCount: 0 })).toBe(
      false,
    );
    await expect(
      provider.subscribeRealtime({
        interval,
        onPoint: jest.fn(),
        signal,
        subscriberId: 'stock-chart',
      }),
    ).resolves.toBeNull();
  });
});
