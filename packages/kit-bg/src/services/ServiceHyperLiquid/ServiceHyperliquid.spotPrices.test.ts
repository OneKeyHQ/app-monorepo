/* cspell:ignore HWAVE */

import type { ISpotMetaAndAssetCtxsResponse } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsActiveAccountAtom,
  perpsSpotBalancesAtom,
  spotAssetCtxsMapAtom,
} from '../../states/jotai/atoms';
import { globalJotaiStorageReadyHandler } from '../../states/jotai/jotaiStorage';

import { hyperLiquidApiClients } from './hyperLiquidApiClients';
import ServiceHyperliquid from './ServiceHyperliquid';
import ServiceHyperliquidSubscription from './ServiceHyperliquidSubscription';
import { generateSubscriptionKey } from './utils/SubscriptionConfig';

import type { ISubscriptionSpec } from './utils/SubscriptionConfig';

jest.mock('p-timeout', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('@nktkas/hyperliquid', () => ({}));
jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: { infoClient: { spotMetaAndAssetCtxs: jest.fn() } },
}));
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const expectPrice = (markPx: string) =>
  expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
    '@241': expect.objectContaining({ markPx }),
  });

describe('ServiceHyperliquid spot price source', () => {
  let service: ServiceHyperliquid;
  let recalculateSpy: jest.SpiedFunction<
    ServiceHyperliquid['recalculateSpotTotalUsd']
  >;

  const prepareBalances = async (spotTotalUsd: string) => {
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
      spotTotalUsd,
    });
  };

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
    await service.updateSpotAssetCtxsMap([
      { ...spotCtx, markPx: '0.001', prevDayPx: '0' },
    ]);
    await service.extractSpotPricesFromAllMids({ '@241': '0.001239' }, true);
    jest.advanceTimersByTime(1000);
    expect(spotAssetCtxsMapAtom.set).toHaveBeenLastCalledWith({
      '@241': expect.objectContaining({ markPx: '0.001', prevDayPx: '0' }),
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
        // Contexts can still arrive without a subscription, but must not block mids.
        await internals._handleSubscriptionData(
          ESubscriptionType.SPOT_ASSET_CTXS,
          {
            detail: [spotCtx],
          } as CustomEvent,
        );
        jest.advanceTimersByTime(1000);
        expectPrice(spotCtx.markPx);
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

    it.each(['refreshSpotMeta', '_getSpotPriceMapMemo'] as const)(
      'ignores late REST prices from %s after subscription teardown',
      async (method) => {
        const request = await beginSubscription();
        await request.acknowledge();
        await hydrate();
        const response = deferred<ISpotMetaAndAssetCtxsResponse>();
        jest
          .spyOn(hyperLiquidApiClients.infoClient, 'spotMetaAndAssetCtxs')
          .mockReturnValueOnce(response.promise);
        const capsSpy = jest
          .spyOn(service, 'refreshSpotExternalMarketCaps')
          .mockResolvedValue({});
        const refresh = service[method]();
        await internals._destroySubscription(spec);
        // The response arrives after teardown but before a new subscription.
        response.resolve([
          { tokens: [], universe: [] },
          [{ ...spotCtx, markPx: '0.0011' }],
        ]);
        await refresh;
        const retry = await beginSubscription();
        await receiveMids('0.0021');
        expectPrice('0.0021');
        await retry.acknowledge();
        await hydrate('0.0018');
        await receiveMids('0.0022');
        expectPrice('0.0018');
        capsSpy.mockRestore();
      },
    );

    it('ignores REST prices if teardown happens while metadata is being persisted', async () => {
      const request = await beginSubscription();
      await request.acknowledge();
      await hydrate();
      const started = deferred<void>();
      const pending = deferred<void>();
      const metadataSpy = jest
        .spyOn(service.backgroundApi.simpleDb.perp, 'setSpotMeta')
        .mockImplementationOnce(async () => {
          started.resolve();
          await pending.promise;
        });
      jest
        .spyOn(hyperLiquidApiClients.infoClient, 'spotMetaAndAssetCtxs')
        .mockResolvedValueOnce([{ tokens: [], universe: [] }, [spotCtx]]);
      const capsSpy = jest
        .spyOn(service, 'refreshSpotExternalMarketCaps')
        .mockResolvedValue({});
      const refresh = service.refreshSpotMeta();
      await started.promise;
      await internals._destroySubscription(spec);
      pending.resolve();
      await refresh;
      const retry = await beginSubscription();
      await receiveMids('0.0021');
      expectPrice('0.0021');
      await retry.acknowledge();
      metadataSpy.mockRestore();
      capsSpy.mockRestore();
    });

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

  it.each([
    { total: '2000', expectedTotalUsd: '4', missingPrices: false },
    { total: '0', expectedTotalUsd: '0', missingPrices: false },
    { total: '1', expectedTotalUsd: '1.4', missingPrices: true },
  ])(
    'preserves newer balances and valuation fallback when an older recalculation finishes last (total=$total, missingPrices=$missingPrices)',
    async ({ total, expectedTotalUsd, missingPrices }) => {
      await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: '0.002' }]);
      await prepareBalances('1.4');

      const mappingsReady = deferred<void>();
      const mappingsStarted = deferred<void>();
      const metadataSpy = jest
        .spyOn(service, 'getSpotMeta')
        .mockResolvedValue({ tokens: [], universes: [] })
        .mockImplementationOnce(async () => {
          mappingsStarted.resolve();
          await mappingsReady.promise;
          return { tokens: [], universes: [] };
        });
      const cache = service.backgroundApi.serviceHyperliquidCache;
      const snapshotSpy = jest.spyOn(cache, 'writePerpsAccountDisplaySnapshot');
      const balancesCacheSpy = jest.spyOn(
        cache,
        'writePerpsAccountDisplaySpotBalances',
      );
      recalculateSpy.mockImplementation(
        ServiceHyperliquid.prototype.recalculateSpotTotalUsd.bind(service),
      );

      const staleRecalculation = service.recalculateSpotTotalUsd({
        force: true,
      });
      try {
        await mappingsStarted.promise;
        let balances =
          total === '0'
            ? []
            : [{ coin: '@241', token: 241, total, hold: '0', entryNtl: '0' }];
        if (missingPrices) {
          balances = [
            { coin: 'USDC', token: 0, total: '10', hold: '0', entryNtl: '0' },
            { coin: '@999', token: 999, total: '1', hold: '0', entryNtl: '0' },
          ];
        }
        await service.updateSpotBalances({
          user: '0xabc',
          spotState: { balances },
        });
        const latestState = await perpsSpotBalancesAtom.get();
        expect(latestState).toEqual({
          accountAddress: '0xabc',
          balances,
          spotTotalUsd: expectedTotalUsd,
        });
        snapshotSpy.mockClear();
        balancesCacheSpy.mockClear();

        mappingsReady.resolve();
        await staleRecalculation;

        expect(await perpsSpotBalancesAtom.get()).toEqual(latestState);
        expect(snapshotSpy).not.toHaveBeenCalled();
        expect(balancesCacheSpy).not.toHaveBeenCalled();
        if (missingPrices) {
          await jest.advanceTimersByTimeAsync(10_000);
          expect(await perpsSpotBalancesAtom.get()).toEqual({
            accountAddress: '0xabc',
            balances,
            spotTotalUsd: '10',
          });
          expect(balancesCacheSpy).toHaveBeenLastCalledWith({
            accountAddress: '0xabc',
            balances,
            spotTotalUsd: '10',
          });
        }
      } finally {
        mappingsReady.resolve();
        await staleRecalculation;
        metadataSpy.mockRestore();
        snapshotSpy.mockRestore();
        balancesCacheSpy.mockRestore();
        await perpsSpotBalancesAtom.set(undefined);
      }
    },
  );

  it.each([
    { price: '0.002', expected: '2', writesBeforeRelease: 1 },
    { price: '0.0014', expected: '1.4', writesBeforeRelease: 0 },
  ])(
    'persists the latest committed valuation after delayed broadcast (next price=$price)',
    async ({ price, expected, writesBeforeRelease }) => {
      await service.updateSpotAssetCtxsMap([spotCtx]);
      await prepareBalances('0');
      const pending = deferred<void>();
      const started = deferred<void>();
      const originalSet = perpsSpotBalancesAtom.set.bind(perpsSpotBalancesAtom);
      // The real setter commits synchronously before awaiting the bg-to-UI broadcast.
      const setterSpy = jest
        .spyOn(perpsSpotBalancesAtom, 'set')
        .mockImplementationOnce(async (...args) => {
          await originalSet(...args);
          started.resolve();
          await pending.promise;
        });
      const cacheSpy = jest.spyOn(
        service.backgroundApi.serviceHyperliquidCache,
        'writePerpsAccountDisplaySpotBalances',
      );
      recalculateSpy.mockImplementation(
        ServiceHyperliquid.prototype.recalculateSpotTotalUsd.bind(service),
      );
      const oldCalculation = service.recalculateSpotTotalUsd({ force: true });
      try {
        await started.promise;
        recalculateSpy.mockResolvedValue(undefined);
        await service.updateSpotAssetCtxsMap([{ ...spotCtx, markPx: price }]);
        recalculateSpy.mockImplementation(
          ServiceHyperliquid.prototype.recalculateSpotTotalUsd.bind(service),
        );
        await service.recalculateSpotTotalUsd({ force: true });
        expect((await perpsSpotBalancesAtom.get())?.spotTotalUsd).toBe(
          expected,
        );
        expect(cacheSpy).toHaveBeenCalledTimes(writesBeforeRelease);
        pending.resolve();
        await oldCalculation;
        expect((await perpsSpotBalancesAtom.get())?.spotTotalUsd).toBe(
          expected,
        );
        expect(cacheSpy).toHaveBeenCalledTimes(1);
        expect(cacheSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ spotTotalUsd: expected }),
        );
      } finally {
        pending.resolve();
        await oldCalculation;
        setterSpy.mockRestore();
        cacheSpy.mockRestore();
        await perpsSpotBalancesAtom.set(undefined);
      }
    },
  );

  it('updates an existing spot valuation from fallback mids without a new balance event', async () => {
    await service.updateSpotAssetCtxsMap([spotCtx]);
    await prepareBalances('1.4');
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
