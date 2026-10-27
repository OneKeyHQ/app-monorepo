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
      marketWsValue: '1H',
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

describe('stock non-trading windows', () => {
  const interval = {
    label: '1m',
    value: '1',
    seconds: 60,
    marketWsValue: '1m',
    hyperliquidValue: '1m',
  } as const;
  const timeTo = Date.UTC(2026, 8, 6, 12) / 1000;
  const timeFrom = timeTo - 100 * 60;
  const empty = { pointType: 'ohlc', points: [], total: 0 } as const;
  const provider = createTradingViewNativeStockDataProvider({
    kind: 'stock',
    stockId: 'AAPL',
  });

  beforeEach(() => fetchMarketStockKLineDataMock.mockReset());

  it('crosses a weekend to return the previous trading session', async () => {
    const friday = Date.UTC(2026, 8, 4, 18) / 1000;
    const point = { o: 1, h: 2, l: 0, c: 1, v: 1, t: friday };
    fetchMarketStockKLineDataMock
      .mockResolvedValueOnce({ ...empty, points: [] })
      .mockResolvedValueOnce({ ...empty, points: [] })
      .mockResolvedValueOnce({ pointType: 'ohlc', points: [point], total: 1 });
    const data = await provider.fetchHistory({
      interval,
      signal: new AbortController().signal,
      timeFrom,
      timeTo,
      allowEarlierHistory: true,
    });
    expect(data?.points).toEqual([point]);
    const requests = fetchMarketStockKLineDataMock.mock.calls.map(
      ([request]) => request,
    );
    expect(requests).toHaveLength(3);
    expect(requests[0]).toEqual({
      interval: '1m',
      stockId: 'AAPL',
      timeFrom,
      timeTo,
    });
    expect(requests[1].timeTo).toBe(timeFrom - 1);
    expect(requests[2].timeTo).toBe(requests[1].timeFrom - 1);
    expect(requests[2].timeFrom).toBeLessThanOrEqual(friday);
    expect(requests[2].timeTo).toBeGreaterThanOrEqual(friday);
  });

  it('keeps an explicitly selected calendar range unchanged when it is empty', async () => {
    fetchMarketStockKLineDataMock.mockResolvedValue({ ...empty, points: [] });
    const data = await provider.fetchHistory({
      interval,
      signal: new AbortController().signal,
      timeFrom,
      timeTo,
    });
    expect(data?.points).toEqual([]);
    expect(fetchMarketStockKLineDataMock).toHaveBeenCalledTimes(1);
  });

  it('bounds empty history searches and never requests negative timestamps', async () => {
    fetchMarketStockKLineDataMock.mockResolvedValue({ ...empty, points: [] });
    await provider.fetchHistory({
      interval,
      signal: new AbortController().signal,
      timeFrom,
      timeTo,
      allowEarlierHistory: true,
    });
    expect(fetchMarketStockKLineDataMock).toHaveBeenCalledTimes(8);
    fetchMarketStockKLineDataMock.mockClear();
    await provider.fetchHistory({
      interval,
      signal: new AbortController().signal,
      timeFrom: 100,
      timeTo: 200,
      allowEarlierHistory: true,
    });
    expect(fetchMarketStockKLineDataMock).toHaveBeenCalledTimes(2);
    expect(fetchMarketStockKLineDataMock.mock.calls[1][0].timeFrom).toBe(0);
  });

  it('stops gap recovery when the source or interval request is aborted', async () => {
    const controller = new AbortController();
    fetchMarketStockKLineDataMock.mockImplementation(async () => {
      controller.abort();
      return { ...empty, points: [] };
    });
    await expect(
      provider.fetchHistory({
        interval,
        signal: controller.signal,
        timeFrom,
        timeTo,
        allowEarlierHistory: true,
      }),
    ).resolves.toBeNull();
    expect(fetchMarketStockKLineDataMock).toHaveBeenCalledTimes(1);
  });
});
