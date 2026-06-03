import type { IEventCandleParameters } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';
import {
  type ISubscriptionSpec,
  type ISubscriptionState,
  generateSubscriptionKey,
} from './utils/SubscriptionConfig';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

jest.mock('@nktkas/hyperliquid', () => ({
  SubscriptionClient: jest.fn(),
  WebSocketTransport: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

type IMarketCandleSubscriptionTestRecord = IEventCandleParameters & {
  generation: number;
};

type ITestClient = {
  clientId: string;
  transport: {
    socket: {
      readyState: number;
    };
  };
  subscribe: jest.MockedFunction<
    (type: ESubscriptionType, params: unknown) => Promise<void>
  >;
  unsubscribe: jest.MockedFunction<
    (type: ESubscriptionType, params: unknown) => Promise<void>
  >;
  dispose: jest.MockedFunction<() => Promise<void>>;
};

type ITestRequiredSubscriptionInfo = {
  requiredSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>>;
  params: ISubscriptionState;
  marketCandleSubscriptionStateVersion: number;
};

type ITestService = {
  subscriptionsHandlerDisabled: boolean;
  connect: () => Promise<void>;
  updateSubscriptions: () => Promise<void>;
  buildRequiredSubscriptionsMap: () => Promise<
    ITestRequiredSubscriptionInfo | undefined
  >;
  subscribeMarketCandle: (params: {
    subscriberId: string;
    coin: string;
    interval: IEventCandleParameters['interval'];
    generation: number;
  }) => Promise<void>;
  unsubscribeMarketCandle: (params: {
    subscriberId: string;
    generation: number;
  }) => Promise<void>;
  _client: unknown;
  _marketCandleSubscriptionsBySubscriber: Map<
    string,
    IMarketCandleSubscriptionTestRecord
  >;
  allSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>>;
  pendingSubSpecsMap: Record<string, ISubscriptionSpec<ESubscriptionType>>;
  _marketCandleSubscriptionStateVersion: number;
  _waitForOpenSocket: (params: {
    client: unknown;
    timeoutMs: number;
  }) => Promise<boolean>;
  _syncMarketCandleSubscriptions: () => Promise<void>;
  _updateSubscriptionsCore: (
    preparedRequiredSubInfo?: unknown,
  ) => Promise<void>;
};

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function createMockClient(readyState: number = WebSocket.OPEN): ITestClient {
  return {
    clientId: 'test-client',
    transport: {
      socket: {
        readyState,
      },
    },
    subscribe: jest.fn<Promise<void>, [ESubscriptionType, unknown]>(
      async () => undefined,
    ),
    unsubscribe: jest.fn<Promise<void>, [ESubscriptionType, unknown]>(
      async () => undefined,
    ),
    dispose: jest.fn<Promise<void>, []>(async () => undefined),
  };
}

function getCandleSpecs(
  specsMap: Record<string, ISubscriptionSpec<ESubscriptionType>>,
) {
  return Object.values(specsMap).filter(
    (spec): spec is ISubscriptionSpec<ESubscriptionType.CANDLE> =>
      spec.type === ESubscriptionType.CANDLE,
  );
}

function getCandleSubscribeParams(client: ITestClient) {
  return client.subscribe.mock.calls
    .filter(([type]) => type === ESubscriptionType.CANDLE)
    .map(([, params]) => params as IEventCandleParameters);
}

function buildSubscriptionState(
  marketCandleSubscriptions: IEventCandleParameters[] = [],
): ISubscriptionState {
  return {
    currentUser: null,
    currentSymbol: '',
    isConnected: true,
    tradingMode: 'perp',
    marketCandleSubscriptions,
  };
}

function buildCandleSpec(
  params: IEventCandleParameters,
): ISubscriptionSpec<ESubscriptionType.CANDLE> {
  return {
    type: ESubscriptionType.CANDLE,
    key: generateSubscriptionKey(ESubscriptionType.CANDLE, params),
    params,
    priority: 2,
  };
}

function buildService(options?: { mockSync?: boolean }) {
  const service = new ServiceHyperliquidSubscription({
    backgroundApi: {} as IBackgroundApi,
  }) as unknown as ITestService;

  service.connect = jest.fn<Promise<void>, []>(async () => undefined);
  service.updateSubscriptions = jest.fn<Promise<void>, []>(
    async () => undefined,
  );
  if (options?.mockSync !== false) {
    service._syncMarketCandleSubscriptions = jest.fn<Promise<void>, []>(
      async () => undefined,
    );
  }

  return service;
}

function getMockedMethods(service: ITestService) {
  return {
    connect: service.connect as jest.MockedFunction<() => Promise<void>>,
    updateSubscriptions: service.updateSubscriptions as jest.MockedFunction<
      () => Promise<void>
    >,
    syncMarketCandleSubscriptions:
      service._syncMarketCandleSubscriptions as jest.MockedFunction<
        () => Promise<void>
      >,
  };
}

describe('ServiceHyperliquidSubscription market candle lifecycle', () => {
  it('syncs only market candle subscriptions when the Perp handler is disabled', async () => {
    const service = buildService();
    const mocks = getMockedMethods(service);
    service.subscriptionsHandlerDisabled = true;

    await service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: ' BTC ',
      interval: '1m',
      generation: 1,
    });

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubscriptions).not.toHaveBeenCalled();
    expect(mocks.syncMarketCandleSubscriptions).toHaveBeenCalledTimes(1);
    expect(
      service._marketCandleSubscriptionsBySubscriber.get('market-chart'),
    ).toEqual({
      coin: 'BTC',
      interval: '1m',
      generation: 1,
    });
  });

  it('uses the regular subscription update path when the handler is enabled', async () => {
    const service = buildService();
    const mocks = getMockedMethods(service);

    await service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: 'ETH',
      interval: '5m',
      generation: 1,
    });

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubscriptions).toHaveBeenCalledTimes(1);
    expect(mocks.syncMarketCandleSubscriptions).not.toHaveBeenCalled();
  });

  it('cleans up market candle subscriptions through the disabled-safe path', async () => {
    const service = buildService();
    const mocks = getMockedMethods(service);
    service.subscriptionsHandlerDisabled = true;
    service._client = {};
    service._marketCandleSubscriptionsBySubscriber.set('market-chart', {
      coin: 'BTC',
      interval: '1m',
      generation: 1,
    });

    await service.unsubscribeMarketCandle({
      subscriberId: 'market-chart',
      generation: 1,
    });

    expect(mocks.updateSubscriptions).not.toHaveBeenCalled();
    expect(mocks.syncMarketCandleSubscriptions).toHaveBeenCalledTimes(1);
    expect(
      service._marketCandleSubscriptionsBySubscriber.has('market-chart'),
    ).toBe(false);
  });

  it('preserves a newer subscription when a stale unsubscribe arrives later', async () => {
    const service = buildService();
    service._client = {};

    await service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: 'BTC',
      interval: '1m',
      generation: 1,
    });
    await service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: 'ETH',
      interval: '5m',
      generation: 2,
    });
    await service.unsubscribeMarketCandle({
      subscriberId: 'market-chart',
      generation: 1,
    });

    expect(
      service._marketCandleSubscriptionsBySubscriber.get('market-chart'),
    ).toEqual({
      coin: 'ETH',
      interval: '5m',
      generation: 2,
    });
  });

  it('preserves a newer subscription when a stale subscribe arrives later', async () => {
    const service = buildService();

    await service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: 'ETH',
      interval: '5m',
      generation: 2,
    });
    await service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: 'BTC',
      interval: '1m',
      generation: 1,
    });

    expect(
      service._marketCandleSubscriptionsBySubscriber.get('market-chart'),
    ).toEqual({
      coin: 'ETH',
      interval: '5m',
      generation: 2,
    });
  });

  it('does not apply a delayed disabled-handler sync snapshot after unsubscribe', async () => {
    const service = buildService({ mockSync: false });
    const client = createMockClient(WebSocket.CONNECTING);
    const socketOpen = createDeferred<boolean>();
    const waitForOpenStarted = createDeferred<void>();
    service._client = client;
    service.subscriptionsHandlerDisabled = true;
    service._waitForOpenSocket = jest.fn<
      Promise<boolean>,
      [{ client: unknown; timeoutMs: number }]
    >(async () => {
      waitForOpenStarted.resolve();
      const isOpen = await socketOpen.promise;
      if (isOpen) {
        client.transport.socket.readyState = WebSocket.OPEN;
      }
      return isOpen;
    });

    const subscribePromise = service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: 'BTC',
      interval: '1m',
      generation: 1,
    });
    await waitForOpenStarted.promise;
    await service.unsubscribeMarketCandle({
      subscriberId: 'market-chart',
      generation: 1,
    });
    socketOpen.resolve(true);
    await subscribePromise;

    expect(getCandleSpecs(service.allSubSpecsMap)).toEqual([]);
    expect(getCandleSpecs(service.pendingSubSpecsMap)).toEqual([]);
    expect(getCandleSubscribeParams(client)).toEqual([]);
  });

  it('keeps only the latest disabled-handler candle after a delayed switch', async () => {
    const service = buildService({ mockSync: false });
    const client = createMockClient(WebSocket.CONNECTING);
    const socketOpen = createDeferred<boolean>();
    const waitForOpenStarted = createDeferred<void>();
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    service._client = client;
    service.subscriptionsHandlerDisabled = true;
    service._waitForOpenSocket = jest.fn<
      Promise<boolean>,
      [{ client: unknown; timeoutMs: number }]
    >(async () => {
      waitForOpenStarted.resolve();
      const isOpen = await socketOpen.promise;
      if (isOpen) {
        client.transport.socket.readyState = WebSocket.OPEN;
      }
      return isOpen;
    });

    try {
      const btcSubscribePromise = service.subscribeMarketCandle({
        subscriberId: 'market-chart',
        coin: 'BTC',
        interval: '1m',
        generation: 1,
      });
      await waitForOpenStarted.promise;
      const ethSubscribePromise = service.subscribeMarketCandle({
        subscriberId: 'market-chart',
        coin: 'ETH',
        interval: '5m',
        generation: 2,
      });
      socketOpen.resolve(true);
      await Promise.all([btcSubscribePromise, ethSubscribePromise]);

      expect(
        getCandleSpecs(service.allSubSpecsMap).map((spec) => spec.params),
      ).toEqual([{ coin: 'ETH', interval: '5m' }]);
      expect(
        getCandleSpecs(service.pendingSubSpecsMap).map((spec) => spec.params),
      ).toEqual([{ coin: 'ETH', interval: '5m' }]);
      expect(getCandleSubscribeParams(client)).toEqual([
        { coin: 'ETH', interval: '5m' },
      ]);
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it('rebuilds stale enabled-path required info before applying candle specs', async () => {
    const service = buildService({ mockSync: false });
    const client = createMockClient();
    const staleCandleSpec = buildCandleSpec({ coin: 'BTC', interval: '1m' });
    service._client = client;
    service._marketCandleSubscriptionStateVersion = 2;
    service.buildRequiredSubscriptionsMap = jest.fn<
      Promise<ITestRequiredSubscriptionInfo>,
      []
    >(async () => ({
      requiredSubSpecsMap: {},
      params: buildSubscriptionState(),
      marketCandleSubscriptionStateVersion: 2,
    }));

    const staleRequiredSubInfo: ITestRequiredSubscriptionInfo = {
      requiredSubSpecsMap: {
        [staleCandleSpec.key]: staleCandleSpec,
      },
      params: buildSubscriptionState([{ coin: 'BTC', interval: '1m' }]),
      marketCandleSubscriptionStateVersion: 1,
    };

    await service._updateSubscriptionsCore(staleRequiredSubInfo);

    expect(service.buildRequiredSubscriptionsMap).toHaveBeenCalledTimes(1);
    expect(getCandleSpecs(service.allSubSpecsMap)).toEqual([]);
    expect(getCandleSpecs(service.pendingSubSpecsMap)).toEqual([]);
    expect(getCandleSubscribeParams(client)).toEqual([]);
  });
});
