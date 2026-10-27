import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';

import { EChannel } from './const';
import ServiceMarketWS from './ServiceMarektWs';
import { EMessageType } from './types/messageType';

const globalMockBag = globalThis as typeof globalThis & {
  __marketWsEventBus?: {
    on: jest.Mock;
    emit: jest.Mock;
  };
};

type IMarketWSMessageHarness = {
  handleMarketMessage: (data: unknown) => void;
};

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundMethod:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundMethodForDev:
    () =>
    (_target: object, _propertyKey: string, descriptor: PropertyDescriptor) =>
      descriptor,
  backgroundClass: () => (constructor: unknown) => constructor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const eventBus = {
    on: jest.fn(),
    emit: jest.fn(),
  };
  (
    globalThis as typeof globalThis & {
      __marketWsEventBus?: typeof eventBus;
    }
  ).__marketWsEventBus = eventBus;
  return {
    EAppEventBusNames: {
      MarketWSDataUpdate: 'MarketWSDataUpdate',
      MemoryPressureWarning: 'MemoryPressureWarning',
    },
    appEventBus: eventBus,
  };
});

function buildService() {
  return new ServiceMarketWS({
    backgroundApi: {},
  });
}

function emitPriceData({
  service,
  symbol,
}: {
  service: ServiceMarketWS;
  symbol: string;
}) {
  (service as unknown as IMarketWSMessageHarness).handleMarketMessage({
    type: EMessageType.PRICE_DATA,
    data: {
      address: '',
      symbol,
      type: '1m',
      eventType: 'ohlcv',
      unixTime: 1_782_821_411,
      o: '1',
      h: '1',
      l: '1',
      c: '1',
      v: '1',
      dataSource: 'okx',
    },
  });
}

describe('ServiceMarketWS native token price routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['1H', '1H'],
    ['1h', '1H'],
    ['4h', '4H'],
    ['1d', '1D'],
    ['1w', '1W'],
  ])(
    'routes %s candles to the %s subscription',
    (incomingInterval, chartType) => {
      const service = buildService();
      service.subscriptionTracker.addSubscription({
        address: '0xabc',
        type: EChannel.ohlcv,
        networkId: 'evm--1',
        chartType,
        currency: 'usd',
      });

      (service as unknown as IMarketWSMessageHarness).handleMarketMessage({
        type: EMessageType.PRICE_DATA,
        data: [
          {
            address: '0xabc',
            symbol: 'TEST',
            type: incomingInterval,
            eventType: 'ohlcv',
            unixTime: 1_782_821_411_000,
            o: '100',
            h: '110',
            l: '90',
            c: '105',
            v: '20',
            dataSource: 'okx',
          },
        ],
      });

      expect(globalMockBag.__marketWsEventBus?.emit).toHaveBeenCalledTimes(1);
      expect(globalMockBag.__marketWsEventBus?.emit).toHaveBeenCalledWith(
        EAppEventBusNames.MarketWSDataUpdate,
        expect.objectContaining({
          networkId: 'evm--1',
          channel: 'ohlcv',
          data: expect.objectContaining({ c: 105, unixTime: 1_782_821_411 }),
        }),
      );
    },
  );

  test('routes empty-address price data by subscription symbol and network id', () => {
    const service = buildService();
    service.subscriptionTracker.addSubscription({
      address: '',
      type: EChannel.ohlcv,
      networkId: 'btc--0',
      symbol: 'BTC',
      chartType: '1m',
      currency: 'usd',
    });
    service.subscriptionTracker.addSubscription({
      address: '',
      type: EChannel.ohlcv,
      networkId: 'evm--1',
      symbol: 'ETH',
      chartType: '1m',
      currency: 'usd',
    });

    emitPriceData({ service, symbol: 'BTC' });

    expect(globalMockBag.__marketWsEventBus?.emit).toHaveBeenCalledTimes(1);
    expect(globalMockBag.__marketWsEventBus?.emit).toHaveBeenCalledWith(
      EAppEventBusNames.MarketWSDataUpdate,
      expect.objectContaining({
        tokenAddress: '',
        networkId: 'btc--0',
        isSubscriptionAmbiguous: false,
        data: expect.objectContaining({
          address: '',
          symbol: 'BTC',
        }),
      }),
    );
  });

  test('emits one network-scoped update per matching native subscription', () => {
    const service = buildService();
    service.subscriptionTracker.addSubscription({
      address: '',
      type: EChannel.ohlcv,
      networkId: 'evm--1',
      symbol: 'ETH',
      chartType: '1m',
      currency: 'usd',
    });
    service.subscriptionTracker.addSubscription({
      address: '',
      type: EChannel.ohlcv,
      networkId: 'evm--8453',
      symbol: 'ETH',
      chartType: '1m',
      currency: 'usd',
    });

    emitPriceData({ service, symbol: 'ETH' });

    const emittedNetworkIds =
      globalMockBag.__marketWsEventBus?.emit.mock.calls.map(
        ([, payload]) => (payload as { networkId?: string }).networkId,
      ) ?? [];
    expect(emittedNetworkIds.toSorted()).toEqual(['evm--1', 'evm--8453']);
  });
});
