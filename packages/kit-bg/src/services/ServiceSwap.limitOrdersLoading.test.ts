import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ESwapLimitOrderStatus,
  ESwapQuoteKind,
} from '@onekeyhq/shared/types/swap/types';
import type { IFetchLimitOrderRes } from '@onekeyhq/shared/types/swap/types';

import { EAtomNames } from '../states/jotai/atomNames';
import {
  inAppNotificationAtom,
  swapLimitOrdersLoadingAtom,
} from '../states/jotai/atoms';
import { JotaiBgSync } from '../states/jotai/jotaiBgSync';
import { jotaiUpdateFromUiByBgBroadcast } from '../states/jotai/jotaiInitFromUi';
import { globalJotaiStorageReadyHandler } from '../states/jotai/jotaiStorage';
import { JOTAI_RESET } from '../states/jotai/types';
import { globalAtom, globalAtomRegistry } from '../states/jotai/utils';

import ServiceSwap from './ServiceSwap';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    ...jest.requireActual('@onekeyhq/shared/src/platformEnv').default,
    isNativeBackgroundThread: true,
    isNativeMainThread: false,
    enableNativeBackgroundThread: true,
  },
}));

function createOrder(
  accountId = 'account-a',
  status = ESwapLimitOrderStatus.FULFILLED,
): IFetchLimitOrderRes {
  const token = {
    networkId: 'evm--1',
    contractAddress: 'test-token',
    symbol: 'TEST',
    decimals: 18,
  };
  return {
    orderId: `order-${accountId}`,
    provider: 'test-provider',
    status,
    fromTokenInfo: token,
    toTokenInfo: token,
    kind: ESwapQuoteKind.SELL,
    payAddress: accountId,
    receiveAddress: accountId,
    fromAmount: '1',
    toAmount: '1',
    executedBuyAmount: '1',
    executedSellAmount: '1',
    createdAt: 1,
    expiredAt: 2,
    providerInfo: { provider: 'test-provider', providerName: 'Test' },
    partiallyFillable: false,
    networkId: token.networkId,
    userAddress: accountId,
  };
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createService() {
  const service = new ServiceSwap({ backgroundApi: {} });
  jest.spyOn(service, 'getCacheSwapSupportNetworks').mockResolvedValue([]);
  jest
    .spyOn(service, 'getSupportSwapAllAccounts')
    .mockImplementation(async ({ indexedAccountId = 'account-a' }) => ({
      accountIdKey: indexedAccountId,
      supportAccountsFetchFailed: false,
      swapSupportAccounts: [
        {
          accountId: indexedAccountId,
          networkId: 'evm--1',
          apiAddress: indexedAccountId,
          accountXpub: undefined,
          pub: undefined,
          dbAccount: undefined,
          isNftEnabled: false,
          isBackendIndexed: false,
          deriveType: undefined,
          deriveInfo: undefined,
          isTestnet: false,
        },
      ],
    }));
  const checkLimitOrderStatus = jest
    .spyOn(service, 'checkLimitOrderStatus')
    .mockResolvedValue(undefined);
  const fetchLimitOrders = jest
    .spyOn(service, 'fetchLimitOrders')
    .mockResolvedValue([]);
  return { service, checkLimitOrderStatus, fetchLimitOrders };
}

describe('limit order loading broadcasts', () => {
  const previousBackgroundScope = globalThis.$onekeyIsInBackground;
  const previousBgSync = appGlobals.$jotaiBgSync;
  const sync = new JotaiBgSync();
  const broadcasts: Parameters<
    JotaiBgSync['broadcastStateUpdateFromBgToUi']
  >[0][] = [];
  let initialNotification: Awaited<
    ReturnType<typeof inAppNotificationAtom.get>
  >;

  beforeAll(async () => {
    globalThis.$onekeyIsInBackground = true;
    globalJotaiStorageReadyHandler.resolveReady(true);
    initialNotification = await inAppNotificationAtom.get();
    appGlobals.$jotaiBgSync = sync;
  });

  beforeEach(async () => {
    jest.useFakeTimers();
    jest
      .spyOn(sync, 'broadcastStateUpdateFromBgToUi')
      .mockImplementation(async (params) => {
        broadcasts.push(params);
      });
    await inAppNotificationAtom.set({
      ...initialNotification,
      swapLimitOrders: [],
      swapLimitOrdersAccountIdKey: undefined,
    });
    await swapLimitOrdersLoadingAtom.set(() => false);
    broadcasts.length = 0;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    const restoreBroadcast = jest
      .spyOn(sync, 'broadcastStateUpdateFromBgToUi')
      .mockResolvedValue(undefined);
    await inAppNotificationAtom.set(initialNotification);
    await swapLimitOrdersLoadingAtom.set(() => false);
    restoreBroadcast.mockRestore();
    appGlobals.$jotaiBgSync = previousBgSync;
    globalThis.$onekeyIsInBackground = previousBackgroundScope;
  });

  it('registers a non-persistent false default and resets loading independently', async () => {
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(false);
    expect((await swapLimitOrdersLoadingAtom.ready()).persist).toBe(false);
    expect(globalAtomRegistry.get(EAtomNames.swapLimitOrdersLoadingAtom)).toBe(
      swapLimitOrdersLoadingAtom,
    );
    const notification = await inAppNotificationAtom.get();
    await swapLimitOrdersLoadingAtom.set(() => true);
    await swapLimitOrdersLoadingAtom.set(JOTAI_RESET);
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(false);
    expect(await inAppNotificationAtom.get()).toBe(notification);
    expect(broadcasts.map(({ name, payload }) => ({ name, payload }))).toEqual([
      { name: EAtomNames.swapLimitOrdersLoadingAtom, payload: true },
      { name: EAtomNames.swapLimitOrdersLoadingAtom, payload: false },
    ]);
  });

  it('broadcasts only boolean loading around one order-data publication', async () => {
    const { service, checkLimitOrderStatus } = createService();
    const response = createDeferred<IFetchLimitOrderRes[]>();
    const started = createDeferred<void>();
    jest.spyOn(service, 'fetchLimitOrders').mockImplementation(() => {
      started.resolve();
      return response.promise;
    });
    const notification = await inAppNotificationAtom.get();
    const run = service.swapLimitOrdersFetchLoop('account-a');
    await started.promise;
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(true);
    expect(await inAppNotificationAtom.get()).toBe(notification);
    expect(broadcasts).toEqual([
      { name: EAtomNames.swapLimitOrdersLoadingAtom, payload: true },
    ]);

    const orders = [createOrder()];
    response.resolve(orders);
    await run;
    expect(broadcasts.map(({ name }) => name)).toEqual([
      EAtomNames.swapLimitOrdersLoadingAtom,
      EAtomNames.inAppNotificationAtom,
      EAtomNames.swapLimitOrdersLoadingAtom,
    ]);
    expect(await inAppNotificationAtom.get()).toMatchObject({
      swapLimitOrders: orders,
      swapLimitOrdersAccountIdKey: 'account-a',
    });
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(false);
    expect(checkLimitOrderStatus).toHaveBeenCalledWith(orders, []);
  });

  it('delivers an explicit UI reset when the bg loading broadcast is still queued', async () => {
    jest.replaceProperty(platformEnv, 'isNativeMainThread', true);
    jest.replaceProperty(platformEnv, 'isNativeBackgroundThread', false);
    const mainLoading = globalAtom<boolean>({
      name: EAtomNames.swapLimitOrdersLoadingAtom,
      persist: false,
      initialValue: false,
    }).target;
    mainLoading.atom();
    jest.replaceProperty(platformEnv, 'isNativeMainThread', false);
    jest.replaceProperty(platformEnv, 'isNativeBackgroundThread', true);
    const proxy = jest
      .spyOn(sync, 'proxyStateUpdateActionFromUiToBg')
      .mockImplementation(async ({ payload }) => {
        expect(typeof payload).toBe('boolean');
        await swapLimitOrdersLoadingAtom.set(payload as boolean);
      });
    try {
      const notification = await inAppNotificationAtom.get();
      await swapLimitOrdersLoadingAtom.set(() => true);
      expect(await mainLoading.get()).toBe(false);
      expect(await swapLimitOrdersLoadingAtom.get()).toBe(true);

      await mainLoading.set(false);
      expect(proxy).toHaveBeenCalledWith({
        name: EAtomNames.swapLimitOrdersLoadingAtom,
        payload: false,
      });
      expect(await swapLimitOrdersLoadingAtom.get()).toBe(false);
      expect(broadcasts.map(({ payload }) => payload as unknown)).toEqual([
        true,
        false,
      ]);
      for (const broadcast of broadcasts) {
        await jotaiUpdateFromUiByBgBroadcast({
          ...broadcast,
          $$isFromBgStatesSyncBroadcast: true,
        });
      }
      expect(await mainLoading.get()).toBe(false);
      expect(await inAppNotificationAtom.get()).toBe(notification);
      expect(proxy).toHaveBeenCalledTimes(1);
    } finally {
      globalAtomRegistry.set(
        EAtomNames.swapLimitOrdersLoadingAtom,
        swapLimitOrdersLoadingAtom,
      );
    }
  });

  it('clears loading on a failed fetch without rebroadcasting retained data', async () => {
    const { service } = createService();
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapLimitOrders: [createOrder()],
      swapLimitOrdersAccountIdKey: 'account-a',
    }));
    const notification = await inAppNotificationAtom.get();
    broadcasts.length = 0;
    jest
      .spyOn(service, 'fetchLimitOrders')
      .mockRejectedValue(new Error('offline'));
    await service.swapLimitOrdersFetchLoop('account-a', undefined, true);
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(false);
    expect(await inAppNotificationAtom.get()).toBe(notification);
    expect(broadcasts.map(({ payload }) => payload as unknown)).toEqual([
      true,
      false,
    ]);
    expect(
      broadcasts.every(
        ({ name }) => name === EAtomNames.swapLimitOrdersLoadingAtom,
      ),
    ).toBe(true);
    expect(jest.getTimerCount()).toBe(1);
  });

  it('retains data and retries when account discovery fails', async () => {
    const { service, fetchLimitOrders } = createService();
    const notification = await inAppNotificationAtom.get();
    await swapLimitOrdersLoadingAtom.set(() => true);
    broadcasts.length = 0;
    jest.spyOn(service, 'getSupportSwapAllAccounts').mockResolvedValue({
      accountIdKey: 'account-b',
      swapSupportAccounts: [],
      supportAccountsFetchFailed: true,
    });
    await service.swapLimitOrdersFetchLoop('account-b');
    expect(await inAppNotificationAtom.get()).toBe(notification);
    expect(broadcasts).toEqual([
      { name: EAtomNames.swapLimitOrdersLoadingAtom, payload: false },
    ]);
    expect(fetchLimitOrders).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(1);
  });

  it('does not republish settled orders when the account key is unchanged', async () => {
    const { service, fetchLimitOrders } = createService();
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapLimitOrders: [createOrder()],
      swapLimitOrdersAccountIdKey: 'account-a',
    }));
    const notification = await inAppNotificationAtom.get();
    broadcasts.length = 0;
    await service.swapLimitOrdersFetchLoop('account-a');
    await service.swapLimitOrdersFetchLoop('account-a');
    expect(fetchLimitOrders).not.toHaveBeenCalled();
    expect(await inAppNotificationAtom.get()).toBe(notification);
    expect(broadcasts).toEqual([]);
  });

  it('clears unsupported-account orders once and keeps their ownership key atomic', async () => {
    const { service } = createService();
    await inAppNotificationAtom.set((pre) => ({
      ...pre,
      swapLimitOrders: [createOrder()],
      swapLimitOrdersAccountIdKey: 'account-a',
    }));
    await swapLimitOrdersLoadingAtom.set(() => true);
    broadcasts.length = 0;
    jest.spyOn(service, 'getSupportSwapAllAccounts').mockResolvedValue({
      accountIdKey: 'account-b',
      swapSupportAccounts: [],
      supportAccountsFetchFailed: false,
    });
    await service.swapLimitOrdersFetchLoop('account-b');
    await service.swapLimitOrdersFetchLoop('account-b');
    expect(broadcasts.map(({ name }) => name)).toEqual([
      EAtomNames.inAppNotificationAtom,
      EAtomNames.swapLimitOrdersLoadingAtom,
    ]);
    expect(broadcasts[0].payload).toMatchObject({
      swapLimitOrders: [],
      swapLimitOrdersAccountIdKey: 'account-b',
    });
  });

  it('preserves mutex ordering across overlapping account refreshes', async () => {
    const { service, fetchLimitOrders } = createService();
    const first = createDeferred<IFetchLimitOrderRes[]>();
    const second = createDeferred<IFetchLimitOrderRes[]>();
    const firstStarted = createDeferred<void>();
    const secondStarted = createDeferred<void>();
    jest
      .spyOn(service, 'fetchLimitOrders')
      .mockImplementationOnce(() => {
        firstStarted.resolve();
        return first.promise;
      })
      .mockImplementationOnce(() => {
        secondStarted.resolve();
        return second.promise;
      });
    const firstRun = service.swapLimitOrdersFetchLoop('account-a');
    await firstStarted.promise;
    const secondRun = service.swapLimitOrdersFetchLoop('account-b');
    expect(fetchLimitOrders).toHaveBeenCalledTimes(1);
    first.resolve([createOrder('account-a')]);
    await firstRun;
    await secondStarted.promise;
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(true);
    expect(await inAppNotificationAtom.get()).toMatchObject({
      swapLimitOrdersAccountIdKey: 'account-a',
    });
    second.resolve([createOrder('account-b')]);
    await secondRun;
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(false);
    const dataUpdates = broadcasts.filter(
      ({ name }) => name === EAtomNames.inAppNotificationAtom,
    );
    expect(dataUpdates).toMatchObject([
      { payload: { swapLimitOrdersAccountIdKey: 'account-a' } },
      { payload: { swapLimitOrdersAccountIdKey: 'account-b' } },
    ]);
    expect(await inAppNotificationAtom.get()).toMatchObject({
      swapLimitOrders: [createOrder('account-b')],
      swapLimitOrdersAccountIdKey: 'account-b',
    });
    broadcasts.length = 0;
    await service.swapLimitOrdersFetchLoop('account-a', undefined, false, true);
    expect(fetchLimitOrders).toHaveBeenCalledTimes(2);
    expect(broadcasts).toEqual([]);
  });

  it('continues the global monitor when fetched orders remain open', async () => {
    const { service, checkLimitOrderStatus } = createService();
    const orders = [createOrder('account-a', ESwapLimitOrderStatus.OPEN)];
    jest.spyOn(service, 'fetchLimitOrders').mockResolvedValue(orders);
    await service.swapLimitOrdersFetchLoop('account-a');
    expect(checkLimitOrderStatus).toHaveBeenCalledWith(orders, []);
    expect(jest.getTimerCount()).toBe(1);
    expect(await swapLimitOrdersLoadingAtom.get()).toBe(false);
  });
});
