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
      mocks.candleSnapshot.mockReset().mockResolvedValue([]);
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

  it.each(['1w', '1M'] as const)(
    'repairs only the BTC boundary %s bucket and preserves later prices',
    async (interval) => {
      const gateway = new TradingViewNativeHyperliquidGateway();
      const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
      const start = Date.parse(interval === '1w' ? '2025-02-13' : '2025-02-11');
      const end =
        Date.parse(interval === '1w' ? '2025-02-20' : '2025-03-13') - 1;
      const first = buildCandle({
        s: '@142',
        i: interval,
        t: start,
        T: end,
        o: '240000',
        h: '240000',
        l: '93000',
        c: '97000',
        v: '25',
      });
      const later = buildCandle({
        ...first,
        t: end + 1,
        T: end + 86_400_000,
        o: '100000',
        h: '105000',
        l: '99000',
        c: '102000',
        v: '30',
      });
      const days = [
        buildCandle({
          s: '@142',
          i: '1d',
          t: Date.parse('2025-02-14'),
          T: Date.parse('2025-02-15') - 1,
          o: '240000',
          h: '240000',
          l: '96000',
          c: '97578',
          v: '10',
        }),
        buildCandle({
          s: '@142',
          i: '1d',
          t: Date.parse('2025-02-19'),
          T: Date.parse('2025-02-20') - 1,
          o: '97578',
          h: '99481',
          l: '93000',
          c: '97000',
          v: '15',
        }),
      ];
      mocks?.candleSnapshot
        .mockResolvedValueOnce([first, later])
        .mockResolvedValueOnce(days);
      const signal = new AbortController().signal;
      const result = await gateway.fetchCandles({
        coin: '@142',
        environment: 'mainnet',
        interval,
        signal,
        timeFrom: 0,
        timeTo: (end + 86_400_000) / 1000,
      });
      expect(result.points).toEqual([
        { t: start / 1000, o: 98_998, h: 99_481, l: 93_000, c: 97_000, v: 25 },
        {
          t: (end + 1) / 1000,
          o: 100_000,
          h: 105_000,
          l: 99_000,
          c: 102_000,
          v: 30,
        },
      ]);
      expect(mocks?.candleSnapshot).toHaveBeenLastCalledWith(
        {
          coin: '@142',
          interval: '1d',
          startTime: 1_739_556_000_000,
          endTime: end,
        },
        signal,
      );
    },
  );

  it('repairs ETH monthly history without applying mainnet rules to testnet', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    const first = buildCandle({
      s: '@151',
      i: '1M',
      t: 1_741_824_000_000,
      T: 1_744_415_999_999,
      o: '2001.2',
      h: '4000',
      l: '1388',
      c: '1566.2',
      v: '100',
    });
    const days = [
      buildCandle({
        s: '@151',
        i: '1d',
        t: 1_743_033_600_000,
        T: 1_743_119_999_999,
        o: '3044',
        h: '3045',
        l: '1910.1',
        c: '2003',
        v: '10',
      }),
      buildCandle({
        s: '@151',
        i: '1d',
        t: 1_744_329_600_000,
        T: 1_744_415_999_999,
        o: '2003',
        h: '2100',
        l: '1388',
        c: '1566.2',
        v: '20',
      }),
    ];
    mocks?.candleSnapshot
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce(days);
    const request = {
      coin: '@151',
      interval: '1M',
      timeFrom: 0,
      timeTo: 1_744_416_000,
    } as const;
    expect(
      (await gateway.fetchCandles({ ...request, environment: 'mainnet' }))
        .points,
    ).toEqual([
      { t: 1_741_824_000, o: 2021, h: 2100, l: 1388, c: 1566.2, v: 30 },
    ]);
    mocks?.candleSnapshot.mockResolvedValueOnce([first]);
    expect(
      (await gateway.fetchCandles({ ...request, environment: 'testnet' }))
        .points,
    ).toEqual([
      { t: 1_741_824_000, o: 2001.2, h: 4000, l: 1388, c: 1566.2, v: 100 },
    ]);
    expect(mocks?.candleSnapshot).toHaveBeenCalledTimes(3);
  });

  it('keeps a failed boundary refill retryable instead of displaying a capped whole bucket', async () => {
    const gateway = new TradingViewNativeHyperliquidGateway();
    const mocks = globalMockBag.__tradingViewNativeHyperliquidGatewayMocks;
    mocks?.candleSnapshot
      .mockResolvedValueOnce([
        buildCandle({
          s: '@142',
          i: '1M',
          t: 1_739_232_000_000,
          T: 1_741_823_999_999,
          o: '240000',
          h: '240000',
          l: '76594',
          c: '83651',
        }),
      ])
      .mockResolvedValueOnce([]);
    await expect(
      gateway.fetchCandles({
        coin: '@142',
        environment: 'mainnet',
        interval: '1M',
        timeFrom: 0,
        timeTo: 1_741_824_000,
      }),
    ).rejects.toThrow();
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
