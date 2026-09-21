/* cspell:ignore HWAVE */

import type { ISpotMetaAndAssetCtxsResponse } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsActiveAccountAtom,
  perpsSpotBalancesAtom,
  spotAssetCtxsMapAtom,
} from '../../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import ServiceHyperliquid from './ServiceHyperliquid';
import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';
import { generateSubscriptionKey } from './utils/SubscriptionConfig';

import type { ISubscriptionSpec } from './utils/SubscriptionConfig';

jest.mock('p-timeout', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@nktkas/hyperliquid', () => ({}));
jest.mock('./hyperLiquidApiClients', () => ({ hyperLiquidApiClients: {} }));
jest.mock('../../states/jotai/atoms', () => {
  const actual = jest.requireActual<typeof import('../../states/jotai/atoms')>(
    '../../states/jotai/atoms',
  );
  return {
    ...actual,
    spotAssetCtxsMapAtom: { set: jest.fn(async () => undefined) },
  };
});

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  toastIfError: () => (_target: unknown, _key: string, descriptor: unknown) =>
    descriptor,
}));

// HWAVE spotMetaAndAssetCtxs payload captured on 2026-09-21.
const spotCtx = {
  coin: '@241',
  prevDayPx: '0.001355',
  dayNtlVlm: '345.92922158',
  markPx: '0.0014',
  midPx: '0.001595',
  circulatingSupply: '999062061.4525643587',
  totalSupply: '999062061.4525643587',
  dayBaseVlm: '246978.51',
};

describe('ServiceHyperliquid spot price source', () => {
  let service: ServiceHyperliquid;
  let recalculateSpy: jest.SpiedFunction<
    ServiceHyperliquid['recalculateSpotTotalUsd']
  >;

  beforeAll(() => globalJotaiStorageReadyHandler.resolveReady(true));

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    service = new ServiceHyperliquid({
      backgroundApi: {
        simpleDb: {
          perp: {
            getPerpData: async () => ({}),
            getSpotMeta: async () => ({ tokens: [], universes: [] }),
            setSpotMeta: async () => undefined,
          },
        },
        serviceHyperliquidCache: {
          writePerpsAccountDisplaySnapshot: async () => undefined,
          writePerpsAccountDisplaySpotBalances: async () => undefined,
        },
      },
    });
    recalculateSpy = jest
      .spyOn(service, 'recalculateSpotTotalUsd')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('keeps the mark price when allMids arrives after the spot context', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    await service.extractSpotPricesFromAllMids({ '@241': spotCtx.midPx }, true);
    jest.advanceTimersByTime(1000);

    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({
        markPx: '0.0014',
        prevDayPx: '0.001355',
      }),
    });

    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.001401' }]);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.001401' }),
    });
  });

  it('uses mid prices as a cold fallback until the first spot context arrives', async () => {
    await service.extractSpotPricesFromAllMids({
      '@241': '0.001239',
      BTC: '60000',
    });
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': { markPx: '0.001239' },
    });

    await service.extractSpotPricesFromAllMids({ '@241': '0.00124' });
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': { markPx: '0.00124' },
    });

    // Exact prices from OK-63600: the mid must not overwrite the mark again.
    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.001' }]);
    await service.extractSpotPricesFromAllMids({ '@241': '0.001239' }, true);
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.001' }),
    });
  });

  it('preserves the context price even when the previous day price is zero', async () => {
    await service.updateSpotAssetCtxsMap([{ ...spotCtx, prevDayPx: '0' }]);
    await service.extractSpotPricesFromAllMids({ '@241': spotCtx.midPx }, true);
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({
        markPx: spotCtx.markPx,
        prevDayPx: '0',
      }),
    });
  });

  describe('spot subscription startup', () => {
    const spec: ISubscriptionSpec<ESubscriptionType.SPOT_ASSET_CTXS> = {
      type: ESubscriptionType.SPOT_ASSET_CTXS,
      key: generateSubscriptionKey(ESubscriptionType.SPOT_ASSET_CTXS, {}),
      params: {},
      priority: 2,
    };
    let subscriptions: ServiceHyperliquidSubscription;
    let client: {
      subscribe: jest.Mock<Promise<void>, []>;
      unsubscribe: jest.Mock<Promise<void>, []>;
    };
    let internals: {
      _client: typeof client;
      _createSubscription: (value: typeof spec) => Promise<void>;
      _destroySubscription: (value: typeof spec) => Promise<boolean>;
      _cleanupAllSubscriptions: () => Promise<void>;
      _closeClient: () => Promise<void>;
      _handleSubscriptionData: (
        type: ESubscriptionType,
        event: CustomEvent,
      ) => Promise<void>;
      getWebSocketClient: () => Promise<typeof client>;
      _updateNetworkLiveness: () => void;
      _emitHyperliquidDataUpdate: () => void;
    };
    const hydrate = (markPx = '0.0015') =>
      (
        service as unknown as {
          _applySpotMetaAndAssetCtxsResult: (
            result: ISpotMetaAndAssetCtxsResponse,
          ) => Promise<void>;
        }
      )._applySpotMetaAndAssetCtxsResult([
        { tokens: [], universe: [] },
        [{ ...spotCtx, markPx }],
      ]);
    const receiveMids = async (price: string) => {
      await internals._handleSubscriptionData(ESubscriptionType.ALL_MIDS, {
        detail: { mids: { '@241': price } },
      } as CustomEvent);
      jest.advanceTimersByTime(1000);
    };
    const expectPrice = (markPx: string) =>
      expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
        '@241': expect.objectContaining({ markPx }),
      });
    const closeSocket = () =>
      subscriptions.socketCloseHandler({
        target: { readyState: 3 },
      } as unknown as WebSocketEventMap['close']);
    const beginSubscription = async () => {
      let acknowledge!: () => void;
      let reject!: (error: Error) => void;
      let started!: () => void;
      const requested = new Promise<void>((resolve) => {
        started = resolve;
      });
      client.subscribe.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, rejectRequest) => {
            acknowledge = resolve;
            reject = rejectRequest;
            started();
          }),
      );
      subscriptions.pendingSubSpecsMap[spec.key] = spec;
      const completed = internals._createSubscription(spec);
      await requested;
      return {
        acknowledge: async () => {
          acknowledge();
          await completed;
        },
        reject: async () => {
          reject(new Error('subscribe failed'));
          await completed;
        },
      };
    };

    beforeEach(() => {
      subscriptions = new ServiceHyperliquidSubscription({
        backgroundApi: service.backgroundApi,
      });
      service.backgroundApi.serviceHyperliquid = service;
      service.backgroundApi.serviceHyperliquidSubscription = subscriptions;
      client = {
        subscribe: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
        unsubscribe: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
      };
      internals = subscriptions as unknown as typeof internals;
      internals._client = client;
      jest.spyOn(internals, 'getWebSocketClient').mockResolvedValue(client);
      jest
        .spyOn(internals, '_updateNetworkLiveness')
        .mockImplementation(() => {});
      jest
        .spyOn(internals, '_emitHyperliquidDataUpdate')
        .mockImplementation(() => {});
    });

    it.each(['before request', 'before ACK', 'after ACK'] as const)(
      'protects REST marks received %s, then accepts fresh WS marks',
      async (timing) => {
        if (timing === 'before request') await hydrate();
        const request = await beginSubscription();
        if (timing === 'before ACK') await hydrate();
        if (timing !== 'after ACK') {
          await receiveMids('0.002');
          expectPrice('0.0015');
        }
        await request.acknowledge();
        if (timing === 'after ACK') await hydrate();
        await receiveMids('0.0021');
        expectPrice('0.0015');
        await internals._handleSubscriptionData(
          ESubscriptionType.SPOT_ASSET_CTXS,
          {
            detail: [{ ...spotCtx, markPx: '0.0016' }],
          } as CustomEvent,
        );
        await receiveMids('0.0022');
        expectPrice('0.0016');
      },
    );

    it('preserves a WS context received before subscribe ACK', async () => {
      const request = await beginSubscription();
      await internals._handleSubscriptionData(
        ESubscriptionType.SPOT_ASSET_CTXS,
        {
          detail: [spotCtx],
        } as CustomEvent,
      );
      await receiveMids('0.002');
      expectPrice(spotCtx.markPx);
      await request.acknowledge();
      await receiveMids('0.0021');
      expectPrice(spotCtx.markPx);
    });

    it('keeps changing cold fallback mids until an actual context arrives', async () => {
      await hydrate();
      await receiveMids('0.002');
      expectPrice('0.002');
      const request = await beginSubscription();
      await receiveMids('0.0021');
      expectPrice('0.0021');
      await request.acknowledge();
      await receiveMids('0.0022');
      expectPrice('0.0022');
    });

    it.each(['failure', 'cancel', 'close'] as const)(
      'releases price protection on creation %s and does not revive it on retry',
      async (ending) => {
        const request = await beginSubscription();
        await hydrate();
        await receiveMids('0.002');
        expectPrice('0.0015');
        if (ending === 'failure') {
          const errorSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
          await request.reject();
          errorSpy.mockRestore();
        } else {
          if (ending === 'cancel') {
            delete subscriptions.pendingSubSpecsMap[spec.key];
          } else {
            closeSocket();
          }
          await request.acknowledge();
        }
        // Start the next real creation before mids overwrite the old mark.
        const retry = await beginSubscription();
        await receiveMids('0.0021');
        expectPrice('0.0021');
        await retry.acknowledge();
        await hydrate('0.0018');
        await receiveMids('0.0022');
        expectPrice('0.0018');
      },
    );

    it.each(['unsubscribe', 'close'] as const)(
      'uses new mid prices after %s and during the next subscription',
      async (ending) => {
        const request = await beginSubscription();
        await request.acknowledge();
        await hydrate();
        if (ending === 'unsubscribe') {
          await internals._destroySubscription(spec);
        } else {
          closeSocket();
        }
        await receiveMids('0.002');
        expectPrice('0.002');
        const retry = await beginSubscription();
        await retry.acknowledge();
        jest.mocked(spotAssetCtxsMapAtom.set).mockClear();
        await receiveMids('0.0021');
        expectPrice('0.0021');
        expect(spotAssetCtxsMapAtom.set).toHaveBeenCalledTimes(1);
      },
    );

    it('clears sources when cleanup falls back to closing a failed unsubscribe', async () => {
      const request = await beginSubscription();
      await request.acknowledge();
      await hydrate();
      client.unsubscribe.mockRejectedValueOnce(new Error('unsubscribe failed'));
      const closeSpy = jest
        .spyOn(internals, '_closeClient')
        .mockResolvedValue(undefined);
      await internals._cleanupAllSubscriptions();
      expect(closeSpy).toHaveBeenCalled();
      const retry = await beginSubscription();
      await receiveMids('0.0021');
      expectPrice('0.0021');
      await retry.acknowledge();
    });
  });

  it('resumes mids and requests a valuation refresh after context ownership ends', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    recalculateSpy.mockClear();
    await service.extractSpotPricesFromAllMids({ '@241': '0.002' });
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({
        markPx: '0.002',
        prevDayPx: spotCtx.prevDayPx,
      }),
    });
    expect(recalculateSpy).toHaveBeenCalledWith({
      force: true,
    });

    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.0021' }]);
    await service.extractSpotPricesFromAllMids({ '@241': '0.0022' }, true);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.0021' }),
    });
  });

  it('updates an existing spot valuation from fallback mids without a new balance event', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    await perpsActiveAccountAtom.set({
      accountAddress: '0xabc',
      accountId: null,
      indexedAccountId: null,
      deriveType: 'default',
    });
    await perpsSpotBalancesAtom.set({
      accountAddress: '0xabc',
      balances: [
        { coin: '@241', token: 241, total: '1000', hold: '0', entryNtl: '0' },
      ],
      spotTotalUsd: '1.4',
    });
    recalculateSpy.mockImplementation(
      ServiceHyperliquid.prototype.recalculateSpotTotalUsd.bind(service),
    );

    await service.extractSpotPricesFromAllMids({ '@241': '0.002' });
    await jest.advanceTimersByTimeAsync(1000);
    expect((await perpsSpotBalancesAtom.get())?.spotTotalUsd).toBe('2');

    await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.003' }]);
    await service.extractSpotPricesFromAllMids({ '@241': '0.004' }, true);
    await jest.advanceTimersByTimeAsync(1000);
    expect((await perpsSpotBalancesAtom.get())?.spotTotalUsd).toBe('3');
    await perpsSpotBalancesAtom.set(undefined);
  });
});
