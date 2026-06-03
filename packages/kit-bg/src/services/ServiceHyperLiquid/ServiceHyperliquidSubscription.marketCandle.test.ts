import type { IEventCandleParameters } from '@onekeyhq/shared/types/hyperliquid/sdk';

import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';

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

type ITestService = {
  subscriptionsHandlerDisabled: boolean;
  connect: () => Promise<void>;
  updateSubscriptions: () => Promise<void>;
  subscribeMarketCandle: (params: {
    subscriberId: string;
    coin: string;
    interval: IEventCandleParameters['interval'];
  }) => Promise<void>;
  unsubscribeMarketCandle: (params: { subscriberId: string }) => Promise<void>;
  _client: unknown;
  _marketCandleSubscriptionsBySubscriber: Map<string, IEventCandleParameters>;
  _syncMarketCandleSubscriptions: () => Promise<void>;
};

function buildService() {
  const service = new ServiceHyperliquidSubscription({
    backgroundApi: {} as IBackgroundApi,
  }) as unknown as ITestService;

  service.connect = jest.fn<Promise<void>, []>(async () => undefined);
  service.updateSubscriptions = jest.fn<Promise<void>, []>(
    async () => undefined,
  );
  service._syncMarketCandleSubscriptions = jest.fn<Promise<void>, []>(
    async () => undefined,
  );

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
    });

    expect(mocks.connect).toHaveBeenCalledTimes(1);
    expect(mocks.updateSubscriptions).not.toHaveBeenCalled();
    expect(mocks.syncMarketCandleSubscriptions).toHaveBeenCalledTimes(1);
    expect(
      service._marketCandleSubscriptionsBySubscriber.get('market-chart'),
    ).toEqual({
      coin: 'BTC',
      interval: '1m',
    });
  });

  it('uses the regular subscription update path when the handler is enabled', async () => {
    const service = buildService();
    const mocks = getMockedMethods(service);

    await service.subscribeMarketCandle({
      subscriberId: 'market-chart',
      coin: 'ETH',
      interval: '5m',
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
    });

    await service.unsubscribeMarketCandle({ subscriberId: 'market-chart' });

    expect(mocks.updateSubscriptions).not.toHaveBeenCalled();
    expect(mocks.syncMarketCandleSubscriptions).toHaveBeenCalledTimes(1);
    expect(
      service._marketCandleSubscriptionsBySubscriber.has('market-chart'),
    ).toBe(false);
  });
});
