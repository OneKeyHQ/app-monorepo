import { HttpRequestError } from '@nktkas/hyperliquid';

import type { ICandle } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { TradingViewNativeHyperliquidGateway } from './tradingViewNativeHyperliquidGateway';

type ICandleListener = (candle: ICandle) => void;

interface IHyperliquidMockBag {
  candle: jest.Mock;
  candleListeners: ICandleListener[];
  candleSnapshot: jest.Mock;
  closeFunctions: jest.Mock[];
  readyFunctions: jest.Mock[];
  unsubscribeFunctions: jest.Mock[];
}

const globalMockBag = globalThis as typeof globalThis & {
  __tradingViewNativeHyperliquidGatewayMocks?: IHyperliquidMockBag;
};

jest.mock('@nktkas/hyperliquid', () => {
  const bag: IHyperliquidMockBag = {
    candle: jest.fn(),
    candleListeners: [],
    candleSnapshot: jest.fn(),
    closeFunctions: [],
    readyFunctions: [],
    unsubscribeFunctions: [],
  };
  bag.candle.mockImplementation(
    async (_request: unknown, listener: ICandleListener) => {
      bag.candleListeners.push(listener);
      const unsubscribe = jest.fn().mockResolvedValue(undefined);
      bag.unsubscribeFunctions.push(unsubscribe);
      return { unsubscribe };
    },
  );
  (
    globalThis as typeof globalThis & {
      __tradingViewNativeHyperliquidGatewayMocks?: IHyperliquidMockBag;
    }
  ).__tradingViewNativeHyperliquidGatewayMocks = bag;

  return {
    HttpRequestError: class extends Error {
      response?: Response;

      constructor({ response }: { response?: Response }) {
        super('HTTP request failed');
        this.response = response;
      }
    },
    HttpTransport: jest.fn(),
    InfoClient: jest.fn(() => ({ candleSnapshot: bag.candleSnapshot })),
    SubscriptionClient: jest.fn(() => ({ candle: bag.candle })),
    WebSocketTransport: jest.fn(() => {
      const close = jest.fn().mockResolvedValue(undefined);
      const ready = jest.fn().mockResolvedValue(undefined);
      bag.closeFunctions.push(close);
      bag.readyFunctions.push(ready);
      return { close, ready };
    }),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    networkDoctor: { log: { error: jest.fn() } },
  },
}));

function buildCandle(overrides: Partial<ICandle> = {}): ICandle {
  return {
    t: 1_720_000_000_000,
    T: 1_720_003_599_999,
    s: 'BTC',
    i: '1h',
    o: '63000',
    h: '64000',
    l: '62000',
    c: '63500',
    v: '15',
    n: 10,
    ...overrides,
  };
}

function createDeferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('TradingViewNative Hyperliquid gateway', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    if (mocks) {
      mocks.candleListeners.length = 0;
      mocks.closeFunctions.length = 0;
      mocks.readyFunctions.length = 0;
      mocks.unsubscribeFunctions.length = 0;
      // Drops responses queued by an earlier test that did not use them.
      mocks.candleSnapshot.mockReset();
      mocks.candleSnapshot.mockResolvedValue([]);
    }
  });

  it('multiplexes subscribers for the same environment, coin, and interval', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const firstSubscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener: firstListener,
      subscriberId: 'first',
    });
    const secondSubscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener: secondListener,
      subscriberId: 'second',
    });
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;

    expect(mocks?.candle).toHaveBeenCalledTimes(1);
    mocks?.candleListeners[0]?.(buildCandle());
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);

    await firstSubscription.unsubscribe();
    expect(mocks?.unsubscribeFunctions[0]).not.toHaveBeenCalled();
    await secondSubscription.unsubscribe();
    expect(mocks?.unsubscribeFunctions[0]).toHaveBeenCalledTimes(1);
    expect(mocks?.closeFunctions[0]).toHaveBeenCalledTimes(1);
  });

  it('does not let an obsolete lease remove a replacement subscriber', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const firstSubscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener: firstListener,
      subscriberId: 'chart',
    });
    const secondSubscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener: secondListener,
      subscriberId: 'chart',
    });
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;

    mocks?.candleListeners[0]?.(buildCandle());
    expect(firstListener).not.toHaveBeenCalled();
    expect(secondListener).toHaveBeenCalledTimes(1);

    await firstSubscription.unsubscribe();
    mocks?.candleListeners[0]?.(buildCandle());
    expect(secondListener).toHaveBeenCalledTimes(2);
    expect(mocks?.unsubscribeFunctions[0]).not.toHaveBeenCalled();

    await secondSubscription.unsubscribe();
    expect(mocks?.unsubscribeFunctions[0]).toHaveBeenCalledTimes(1);
  });

  it('keeps a healthy shared connection open while ensuring a quiet channel', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const listener = jest.fn();
    const subscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener,
      subscriberId: 'chart',
    });
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;

    await subscription.ensure();
    expect(mocks?.readyFunctions[0]).toHaveBeenCalledTimes(1);
    expect(mocks?.closeFunctions[0]).not.toHaveBeenCalled();
    expect(mocks?.candle).toHaveBeenCalledTimes(1);
    mocks?.candleListeners[0]?.(buildCandle());
    expect(listener).toHaveBeenCalledTimes(1);

    await subscription.unsubscribe();
    expect(mocks?.unsubscribeFunctions[0]).toHaveBeenCalledTimes(1);
    expect(mocks?.closeFunctions[0]).toHaveBeenCalledTimes(1);
  });

  it('restarts a shared connection only after transport readiness fails', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const listener = jest.fn();
    const subscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener,
      subscriberId: 'chart',
    });
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    mocks?.readyFunctions[0]?.mockRejectedValueOnce(
      new Error('transport terminated'),
    );

    await subscription.ensure();
    expect(mocks?.closeFunctions[0]).toHaveBeenCalledTimes(1);
    expect(mocks?.candle).toHaveBeenCalledTimes(2);
    mocks?.candleListeners[1]?.(buildCandle());
    expect(listener).toHaveBeenCalledTimes(1);

    await subscription.unsubscribe();
    expect(mocks?.unsubscribeFunctions[1]).toHaveBeenCalledTimes(1);
    expect(mocks?.closeFunctions[1]).toHaveBeenCalledTimes(1);
  });

  it('removes a lease that unsubscribes while its connection restarts', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const listener = jest.fn();
    const subscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener,
      subscriberId: 'chart',
    });
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    const closeRequest = createDeferred();
    const closeStarted = createDeferred();
    mocks?.readyFunctions[0]?.mockRejectedValueOnce(
      new Error('transport terminated'),
    );
    mocks?.closeFunctions[0]?.mockImplementationOnce(() => {
      closeStarted.resolve();
      return closeRequest.promise;
    });

    const ensureRequest = subscription.ensure();
    await closeStarted.promise;
    expect(mocks?.closeFunctions[0]).toHaveBeenCalledTimes(1);
    const unsubscribeRequest = subscription.unsubscribe();

    closeRequest.resolve();
    await ensureRequest;
    await unsubscribeRequest;

    expect(mocks?.candle).toHaveBeenCalledTimes(2);
    expect(mocks?.unsubscribeFunctions[1]).toHaveBeenCalledTimes(1);
    mocks?.candleListeners[1]?.(buildCandle());
    expect(listener).not.toHaveBeenCalled();
    expect(mocks?.closeFunctions[1]).toHaveBeenCalledTimes(1);
  });

  it('keeps a new lease on the shared connection during a restart', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const firstListener = jest.fn();
    const secondListener = jest.fn();
    const firstSubscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener: firstListener,
      subscriberId: 'first',
    });
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    const closeRequest = createDeferred();
    const closeStarted = createDeferred();
    mocks?.readyFunctions[0]?.mockRejectedValueOnce(
      new Error('transport terminated'),
    );
    mocks?.closeFunctions[0]?.mockImplementationOnce(() => {
      closeStarted.resolve();
      return closeRequest.promise;
    });

    const ensureRequest = firstSubscription.ensure();
    await closeStarted.promise;
    expect(mocks?.closeFunctions[0]).toHaveBeenCalledTimes(1);
    const secondSubscriptionRequest = gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener: secondListener,
      subscriberId: 'second',
    });

    closeRequest.resolve();
    await ensureRequest;
    const secondSubscription = await secondSubscriptionRequest;

    expect(mocks?.closeFunctions).toHaveLength(2);
    expect(mocks?.candle).toHaveBeenCalledTimes(2);
    mocks?.candleListeners[1]?.(buildCandle());
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);

    await firstSubscription.unsubscribe();
    await secondSubscription.unsubscribe();
    expect(mocks?.closeFunctions[1]).toHaveBeenCalledTimes(1);
  });

  it('closes an unused connection even when channel cleanup fails', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const subscription = await gateway.subscribeCandle({
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      listener: jest.fn(),
      subscriberId: 'chart',
    });
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    mocks?.unsubscribeFunctions[0]?.mockRejectedValueOnce(
      new Error('unsubscribe failed'),
    );

    await expect(subscription.unsubscribe()).rejects.toThrow(
      'unsubscribe failed',
    );
    expect(mocks?.closeFunctions[0]).toHaveBeenCalledTimes(1);
  });

  it('normalizes history and forwards its abort signal', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const abortController = new AbortController();
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    mocks?.candleSnapshot.mockResolvedValue([
      buildCandle(),
      buildCandle({ c: 'invalid' }),
    ]);

    await expect(
      gateway.fetchCandles({
        coin: 'BTC',
        environment: 'mainnet',
        interval: '1h',
        signal: abortController.signal,
        timeFrom: 1_720_000_000,
        timeTo: 1_720_003_600,
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
    expect(mocks?.candleSnapshot).toHaveBeenCalledWith(
      {
        coin: 'BTC',
        interval: '1h',
        startTime: 1_720_000_000_000,
        endTime: 1_720_003_600_000,
      },
      abortController.signal,
    );
  });
  it('clamps mainnet BTC spot requests and normalizes the returned boundary day', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    mocks?.candleSnapshot.mockResolvedValue([
      buildCandle({
        s: '@142',
        i: '1d',
        t: 1_739_491_200_000,
        T: 1_739_577_599_999,
        o: '240000',
        h: '240000',
        l: '96000',
        c: '97578',
      }),
    ]);
    const result = await gateway.fetchCandles({
      coin: '@142',
      environment: 'mainnet',
      interval: '1d',
      timeFrom: 0,
      timeTo: 1_740_000_000,
    });
    expect(mocks?.candleSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: 1_739_556_000_000 }),
      undefined,
    );
    expect(result.points[0]).toMatchObject({
      t: 1_739_491_200,
      o: 98_998,
      h: 98_998,
      l: 96_000,
      c: 97_578,
    });
  });

  describe('rate-limited history', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    const httpError = (status: number) =>
      new HttpRequestError({ response: new Response(null, { status }) });
    const request = {
      coin: 'BTC',
      environment: 'mainnet',
      interval: '1h',
      timeFrom: 1_720_000_000,
      timeTo: 1_720_003_600,
    } as const;

    it('waits five seconds after a 429 and requests the history again', async () => {
      const gateway = new TradingViewNativeHyperliquidGateway();
      const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
      mocks?.candleSnapshot
        .mockRejectedValueOnce(httpError(429))
        .mockRejectedValueOnce(httpError(429))
        .mockResolvedValueOnce([buildCandle()]);

      const result = gateway.fetchCandles({
        ...request,
        signal: new AbortController().signal,
      });
      await jest.advanceTimersByTimeAsync(4999);
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(1);
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(2);
      await jest.advanceTimersByTimeAsync(5000);

      await expect(result).resolves.toMatchObject({ total: 1 });
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(3);
    });

    it('retries a rate limit at most ten times per load', async () => {
      const gateway = new TradingViewNativeHyperliquidGateway();
      const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
      const rateLimit = httpError(429);
      mocks?.candleSnapshot.mockRejectedValue(rateLimit);
      const { signal } = new AbortController();

      const result = gateway.fetchCandles({ ...request, signal });
      await jest.advanceTimersByTimeAsync(9 * 5000);
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(10);
      // The tenth wait ends in the final failure; handle it before it lands.
      await Promise.all([
        expect(result).rejects.toBe(rateLimit),
        jest.advanceTimersByTimeAsync(5000),
      ]);
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(11);

      // A retry of the same load, as the K-line hook makes, fails at once.
      await expect(gateway.fetchCandles({ ...request, signal })).rejects.toBe(
        rateLimit,
      );
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(12);

      // Another load waits again.
      mocks?.candleSnapshot
        .mockRejectedValueOnce(rateLimit)
        .mockResolvedValueOnce([buildCandle()]);
      const nextLoad = gateway.fetchCandles({
        ...request,
        signal: new AbortController().signal,
      });
      await jest.advanceTimersByTimeAsync(5000);
      await expect(nextLoad).resolves.toMatchObject({ total: 1 });
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(14);
    });

    it('stops waiting once the request is aborted', async () => {
      const gateway = new TradingViewNativeHyperliquidGateway();
      const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
      const rateLimit = httpError(429);
      mocks?.candleSnapshot.mockRejectedValueOnce(rateLimit);
      const abortController = new AbortController();

      // Pending until the abort, so it has a handler before it can reject.
      const result = gateway.fetchCandles({
        ...request,
        signal: abortController.signal,
      });
      await jest.advanceTimersByTimeAsync(1000);
      abortController.abort();
      await expect(result).rejects.toBe(rateLimit);
      await jest.advanceTimersByTimeAsync(10_000);

      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(1);
    });

    it('fails other request errors without waiting', async () => {
      const gateway = new TradingViewNativeHyperliquidGateway();
      const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
      const serverError = httpError(500);
      mocks?.candleSnapshot.mockRejectedValueOnce(serverError);

      await expect(gateway.fetchCandles(request)).rejects.toBe(serverError);
      expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(1);
    });
  });

  it('does not request pre-boundary history, while testnet keeps its original range', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    const request = {
      coin: '@142',
      interval: '1d',
      timeFrom: 0,
      timeTo: 1_739_556_000,
    } as const;
    await expect(
      gateway.fetchCandles({ ...request, environment: 'mainnet' }),
    ).resolves.toEqual({ points: [], total: 0 });
    expect(mocks?.candleSnapshot).not.toHaveBeenCalled();
    await gateway.fetchCandles({ ...request, environment: 'testnet' });
    expect(mocks?.candleSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: 0, endTime: 1_739_556_000_000 }),
      undefined,
    );
  });
});
