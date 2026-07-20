import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IMarketWsDataUpdatePayload } from '@onekeyhq/shared/types/marketV2';

import { createTradingViewNativeDataProvider } from './createTradingViewNativeDataProvider';
import { getTradingViewNativeKLineInterval } from './tradingViewNativeIntervals';

type IMarketUpdateHandler = (payload: IMarketWsDataUpdatePayload) => void;

interface IProviderMockBag {
  eventOff: jest.Mock;
  eventOn: jest.Mock;
  marketService: {
    clearDataCount: jest.Mock;
    connect: jest.Mock;
    ensureSubscription: jest.Mock;
    subscribeOHLCV: jest.Mock;
    unsubscribeOHLCV: jest.Mock;
  };
  coinGeckoFetchChart: jest.Mock;
  marketFetchHistory: jest.Mock;
  hyperliquidFetchCandles: jest.Mock;
  hyperliquidSubscribeCandle: jest.Mock;
}

const globalMockBag = globalThis as typeof globalThis & {
  __tradingViewNativeProviderMocks?: IProviderMockBag;
};

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const marketService = {
    clearDataCount: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    ensureSubscription: jest.fn().mockResolvedValue(undefined),
    subscribeOHLCV: jest.fn().mockResolvedValue(undefined),
    unsubscribeOHLCV: jest.fn().mockResolvedValue(undefined),
  };
  const coinGeckoFetchChart = jest.fn();
  (
    globalThis as typeof globalThis & {
      __tradingViewNativeProviderMocks?: IProviderMockBag;
    }
  ).__tradingViewNativeProviderMocks = {
    eventOff: jest.fn(),
    eventOn: jest.fn(),
    marketService,
    coinGeckoFetchChart,
    marketFetchHistory: jest.fn(),
    hyperliquidFetchCandles: jest.fn(),
    hyperliquidSubscribeCandle: jest.fn(),
  };
  return {
    __esModule: true,
    default: {
      serviceMarket: { fetchTokenChart: coinGeckoFetchChart },
      serviceMarketWS: marketService,
    },
  };
});

jest.mock(
  '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData',
  () => ({
    fetchMarketKLineData: (...args: unknown[]): unknown =>
      globalMockBag.__tradingViewNativeProviderMocks?.marketFetchHistory(
        ...args,
      ) as unknown,
  }),
);

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { MarketWSDataUpdate: 'MarketWSDataUpdate' },
  appEventBus: {
    on: (...args: unknown[]): void => {
      globalMockBag.__tradingViewNativeProviderMocks?.eventOn(...args);
    },
    off: (...args: unknown[]): void => {
      globalMockBag.__tradingViewNativeProviderMocks?.eventOff(...args);
    },
  },
}));

jest.mock('./tradingViewNativeHyperliquidGateway', () => ({
  tradingViewNativeHyperliquidGateway: {
    fetchCandles: (...args: unknown[]): unknown =>
      globalMockBag.__tradingViewNativeProviderMocks?.hyperliquidFetchCandles(
        ...args,
      ) as unknown,
    subscribeCandle: (...args: unknown[]): unknown =>
      globalMockBag.__tradingViewNativeProviderMocks?.hyperliquidSubscribeCandle(
        ...args,
      ) as unknown,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    networkDoctor: { log: { error: jest.fn() } },
  },
}));

function getMarketUpdateHandler() {
  return globalMockBag.__tradingViewNativeProviderMocks?.eventOn.mock.calls.find(
    ([eventName]) => eventName === 'MarketWSDataUpdate',
  )?.[1] as IMarketUpdateHandler | undefined;
}

function getInterval(value: string) {
  const interval = getTradingViewNativeKLineInterval(value);
  if (!interval) {
    throw new OneKeyLocalError(`Unsupported test interval: ${value}`);
  }
  return interval;
}

function createDeferred<T = void>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('TradingViewNative data providers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    mocks?.marketService.connect.mockResolvedValue(undefined);
    mocks?.marketService.subscribeOHLCV.mockResolvedValue(undefined);
    mocks?.marketService.unsubscribeOHLCV.mockResolvedValue(undefined);
    mocks?.marketService.ensureSubscription.mockResolvedValue(undefined);
    mocks?.marketService.clearDataCount.mockResolvedValue(undefined);
    mocks?.coinGeckoFetchChart.mockResolvedValue([]);
    mocks?.marketFetchHistory.mockResolvedValue({ points: [], total: 0 });
  });

  it('forwards Market history windows through the direct API adapter', async () => {
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'disabled',
    });

    expect(provider.getHistoryRequestCandleCount(getInterval('60'))).toBe(2000);
    expect(
      provider.hasMoreHistory({
        interval: getInterval('60'),
        receivedPointCount: 299,
      }),
    ).toBe(true);
    expect(
      provider.hasMoreHistory({
        interval: getInterval('60'),
        receivedPointCount: 298,
      }),
    ).toBe(false);

    await provider.fetchHistory({
      interval: getInterval('60'),
      signal: new AbortController().signal,
      timeFrom: 100,
      timeTo: 200,
    });

    expect(
      globalMockBag.__tradingViewNativeProviderMocks?.marketFetchHistory,
    ).toHaveBeenCalledWith({
      tokenAddress: '0xabc',
      networkId: 'evm--1',
      interval: '1H',
      timeFrom: 100,
      timeTo: 200,
      autoHandleError: false,
    });
  });

  it('uses the 200-point API page contract for native Market tokens', () => {
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'btc--0',
      tokenAddress: '',
      symbol: 'BTC',
      realtime: 'disabled',
    });

    expect(provider.getHistoryRequestCandleCount(getInterval('60'))).toBe(2000);
    expect(
      provider.hasMoreHistory({
        interval: getInterval('60'),
        receivedPointCount: 200,
      }),
    ).toBe(true);
    expect(
      provider.hasMoreHistory({
        interval: getInterval('60'),
        receivedPointCount: 199,
      }),
    ).toBe(false);
  });

  it('uses CoinGecko directly for a CoinGecko-only history source', async () => {
    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    mocks?.coinGeckoFetchChart.mockResolvedValue([[7200, 10]]);
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'stock--0',
      tokenAddress: 'stock-aapl',
      symbol: 'AAPL',
      realtime: 'disabled',
      history: {
        provider: 'coinGecko',
        coinGeckoId: 'apple',
      },
    });

    expect(provider.getHistoryRequestCandleCount(getInterval('5'))).toBe(288);
    expect(provider.getHistoryRequestCandleCount(getInterval('15'))).toBe(96);
    expect(provider.getHistoryRequestCandleCount(getInterval('60'))).toBe(720);
    expect(provider.getHistoryRequestCandleCount(getInterval('1D'))).toBe(
      36_500,
    );
    expect(
      provider.hasMoreHistory({
        interval: getInterval('60'),
        receivedPointCount: 500,
      }),
    ).toBe(false);
    expect(provider.key).toBe(
      'market:stock--0:stock-aapl:AAPL:history:coinGecko:apple',
    );
    await expect(
      provider.fetchHistory({
        interval: getInterval('60'),
        signal: new AbortController().signal,
        timeFrom: 3600,
        timeTo: 10_800,
      }),
    ).resolves.toEqual({
      points: [{ o: 10, h: 10, l: 10, c: 10, v: 0, t: 7200 }],
      total: 1,
    });
    expect(mocks?.marketFetchHistory).not.toHaveBeenCalled();
    expect(mocks?.coinGeckoFetchChart).toHaveBeenCalledWith('apple', '30', {
      requestCurrency: 'usd',
    });
  });

  it('deduplicates only in-flight CoinGecko requests', async () => {
    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    const chartRequest = createDeferred<[number, number][]>();
    mocks?.coinGeckoFetchChart.mockReturnValueOnce(chartRequest.promise);
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'stock--0',
      tokenAddress: 'stock-aapl',
      symbol: 'AAPL',
      realtime: 'disabled',
      history: { provider: 'coinGecko', coinGeckoId: 'apple' },
    });
    const request = {
      interval: getInterval('60'),
      signal: new AbortController().signal,
      timeFrom: 3600,
      timeTo: 10_800,
    };

    const firstRequest = provider.fetchHistory(request);
    const secondRequest = provider.fetchHistory(request);
    expect(mocks?.coinGeckoFetchChart).toHaveBeenCalledTimes(1);

    chartRequest.resolve([[7200, 10]]);
    await Promise.all([firstRequest, secondRequest]);
    await expect(provider.fetchHistory(request)).resolves.toEqual({
      points: [],
      total: 0,
    });
    expect(mocks?.coinGeckoFetchChart).toHaveBeenCalledTimes(2);
  });

  it('stops Market pagination after switching to CoinGecko fallback', async () => {
    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    mocks?.coinGeckoFetchChart.mockResolvedValue([[7200, 10]]);
    mocks?.marketFetchHistory.mockImplementationOnce(
      async ({
        kLineDataFallback,
        onPrimaryKLineDataUnavailable,
      }: {
        kLineDataFallback: (params: {
          tokenAddress: string;
          networkId: string;
          interval: string;
          timeFrom: number;
          timeTo: number;
        }) => Promise<unknown>;
        onPrimaryKLineDataUnavailable: () => void;
      }) => {
        onPrimaryKLineDataUnavailable();
        return kLineDataFallback({
          tokenAddress: '0xabc',
          networkId: 'evm--1',
          interval: '1H',
          timeFrom: 3600,
          timeTo: 10_800,
        });
      },
    );
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'disabled',
      history: {
        provider: 'market',
        fallback: {
          provider: 'coinGecko',
          coinGeckoId: 'token',
        },
      },
    });

    expect(provider.getHistoryRequestCandleCount(getInterval('60'))).toBe(2000);
    await expect(
      provider.fetchHistory({
        interval: getInterval('60'),
        signal: new AbortController().signal,
        timeFrom: 3600,
        timeTo: 10_800,
      }),
    ).resolves.toEqual({
      points: [{ o: 10, h: 10, l: 10, c: 10, v: 0, t: 7200 }],
      total: 1,
    });
    expect(mocks?.marketFetchHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        interval: '1H',
        kLineDataFallback: expect.any(Function),
        primaryKLineDataUnavailable: false,
      }),
    );
    expect(mocks?.coinGeckoFetchChart).toHaveBeenCalledWith('token', '30', {
      requestCurrency: 'usd',
    });
    expect(provider.getHistoryRequestCandleCount(getInterval('60'))).toBe(720);
    expect(
      provider.hasMoreHistory({
        interval: getInterval('60'),
        receivedPointCount: 500,
      }),
    ).toBe(false);

    await provider.fetchHistory({
      interval: getInterval('60'),
      signal: new AbortController().signal,
      timeFrom: 1,
      timeTo: 99,
    });
    expect(mocks?.marketFetchHistory).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ primaryKLineDataUnavailable: true }),
    );
  });

  it('adapts validated Market WS candles and owns subscription cleanup', async () => {
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'websocket',
    });
    const interval = getInterval('60');
    const abortController = new AbortController();
    const onPoint = jest.fn();
    const subscription = await provider.subscribeRealtime({
      interval,
      onPoint,
      signal: abortController.signal,
      subscriberId: 'chart',
    });
    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    const marketSubscription = {
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      chartType: '1h',
      currency: 'usd',
    };
    expect(mocks?.marketService.subscribeOHLCV).toHaveBeenCalledWith(
      marketSubscription,
    );

    getMarketUpdateHandler()?.({
      channel: 'ohlcv',
      tokenAddress: '0xabc',
      networkId: 'evm--1',
      data: {
        address: '0xabc',
        symbol: 'TOKEN',
        eventType: 'ohlcv',
        type: '1H',
        unixTime: 3600,
        o: 100,
        h: 110,
        l: 90,
        c: 105,
        v: 20,
      },
    });
    expect(onPoint).toHaveBeenCalledWith({
      o: 100,
      h: 110,
      l: 90,
      c: 105,
      v: 20,
      t: 3600,
    });

    await subscription?.ensure();
    expect(mocks?.marketService.ensureSubscription).toHaveBeenCalledWith({
      ...marketSubscription,
      channel: 'ohlcv',
    });
    await subscription?.unsubscribe();
    expect(mocks?.marketService.unsubscribeOHLCV).toHaveBeenCalledWith(
      marketSubscription,
    );
    expect(mocks?.eventOff).toHaveBeenCalled();
  });

  it('does not create a background subscription after the request is aborted', async () => {
    let resolveConnect: () => void = () => undefined;
    const connectPromise = new Promise<void>((resolve) => {
      resolveConnect = resolve;
    });
    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    mocks?.marketService.connect.mockReturnValueOnce(connectPromise);
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'websocket',
    });
    const interval = getInterval('60');
    const abortController = new AbortController();
    const pendingSubscription = provider.subscribeRealtime({
      interval,
      onPoint: jest.fn(),
      signal: abortController.signal,
      subscriberId: 'chart',
    });

    abortController.abort();
    resolveConnect();
    await expect(pendingSubscription).resolves.toBeNull();
    expect(mocks?.marketService.subscribeOHLCV).not.toHaveBeenCalled();
    expect(mocks?.eventOff).toHaveBeenCalled();
  });

  it('does not recreate a Market subscription while its lease closes', async () => {
    const provider = createTradingViewNativeDataProvider({
      kind: 'market',
      networkId: 'evm--1',
      tokenAddress: '0xabc',
      symbol: 'TOKEN',
      realtime: 'websocket',
    });
    const abortController = new AbortController();
    const subscription = await provider.subscribeRealtime({
      interval: getInterval('60'),
      onPoint: jest.fn(),
      signal: abortController.signal,
      subscriberId: 'chart',
    });
    if (!subscription) {
      throw new OneKeyLocalError('Expected a realtime subscription');
    }

    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    const connectRequest = createDeferred();
    mocks?.marketService.connect.mockReturnValueOnce(connectRequest.promise);
    mocks?.marketService.ensureSubscription.mockClear();
    mocks?.marketService.unsubscribeOHLCV.mockClear();

    const ensureRequest = subscription.ensure();
    await Promise.resolve();
    const unsubscribeRequest = subscription.unsubscribe();
    connectRequest.resolve();
    await ensureRequest;
    await unsubscribeRequest;

    expect(mocks?.marketService.ensureSubscription).not.toHaveBeenCalled();
    expect(mocks?.marketService.unsubscribeOHLCV).toHaveBeenCalledTimes(1);
  });

  it('keeps Hyperliquid transport details behind its adapter', async () => {
    const mocks = globalMockBag.__tradingViewNativeProviderMocks;
    mocks?.hyperliquidFetchCandles.mockResolvedValue({ points: [], total: 0 });
    mocks?.hyperliquidSubscribeCandle.mockResolvedValue({
      ensure: jest.fn(),
      unsubscribe: jest.fn(),
    });
    const provider = createTradingViewNativeDataProvider({
      kind: 'hyperliquid',
      coin: 'BTC',
      environment: 'testnet',
    });
    const interval = getInterval('240');
    expect(provider.getHistoryRequestCandleCount(interval)).toBe(5000);
    expect(
      provider.hasMoreHistory({ interval, receivedPointCount: 5000 }),
    ).toBe(true);
    const abortController = new AbortController();

    await provider.fetchHistory({
      interval,
      signal: abortController.signal,
      timeFrom: 100,
      timeTo: 200,
    });
    expect(mocks?.hyperliquidFetchCandles).toHaveBeenCalledWith({
      coin: 'BTC',
      environment: 'testnet',
      interval: '4h',
      signal: abortController.signal,
      timeFrom: 100,
      timeTo: 200,
    });
  });
});
