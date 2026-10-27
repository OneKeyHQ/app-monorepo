import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { writeContextAtomColdStartCacheValues } from '@onekeyhq/kit-bg/src/states/jotai/utils';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISwapTokenListSnapshotMap } from '@onekeyhq/shared/types/swap/types';

import {
  swapAllNetworkActionLockAtom,
  swapAllNetworkTokenListMapAtom,
  swapAllNetworkTokenListStatusAtom,
  swapTokenFetchingAtom,
  swapTokenListRequestsAtom,
  swapTokenMapAtom,
} from '../../../states/jotai/contexts/swap/atoms';
import { getSwapTokenSelectorStore } from '../../../states/jotai/contexts/swap/tokenSelectorData';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
// Registers the live-store clearer without mounting a selector or root view.
import '../pages/SwapRootProvider';

import { registerSwapTokenSelectorCacheInvalidation } from './swapTokenSelectorCacheInvalidation';
import {
  getSwapTokenSelectorCacheEpoch,
  isSwapTokenSelectorAccountRemoved,
  subscribeSwapTokenSelectorCache,
} from './swapTokenSelectorCacheUtils';

let mockSnapshotRaw: string | undefined;
const mockFlush = jest.fn(async () => undefined);

jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => ({
  readContextAtomSnapshotRaw: () => mockSnapshotRaw,
  writeContextAtomSnapshotRaw: (value: string) => {
    mockSnapshotRaw = value;
  },
}));
jest.mock(
  '@onekeyhq/shared/src/storage/DisplaySnapshotStorage/webUiSnapshotStore',
  () => ({ flushUiSnapshotStoreNow: () => mockFlush() }),
);

const stores = [
  EJotaiContextStoreNames.swapTokenSelector,
  EJotaiContextStoreNames.swap,
  EJotaiContextStoreNames.swapModal,
  EJotaiContextStoreNames.marketSwap,
  EJotaiContextStoreNames.marketSwapReview,
] as const;
const cacheKeys = [
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom,
] as const;
const token = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  balanceParsed: '1',
  fiatValue: '100',
};
const accountId = 'hd-removal-cache--m/44/60/0/0/0';
const indexedAccountId = 'hd-removal-cache--0';
const queryKey = JSON.stringify({
  networkId: 'evm--1',
  accountId,
  accountAddress: 'test-owner',
});
const aggregateKey = `${indexedAccountId}__Swap__usd`;
const snapshot: ISwapTokenListSnapshotMap = {
  version: 1,
  updatedAt: 1,
  tokenCatch: { [queryKey]: { data: [token], updatedAt: 1 } },
};
const globalCache = globalThis as typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};

function emitRemoval(
  event:
    | EAppEventBusNames.WalletRemove
    | EAppEventBusNames.AccountRemove
    | EAppEventBusNames.WalletClear
    | EAppEventBusNames.GlobalDeriveTypeUpdate,
) {
  if (event === EAppEventBusNames.WalletRemove) {
    appEventBus.emit(event, { walletId: 'hd-removal-cache' });
  } else if (event === EAppEventBusNames.AccountRemove) {
    appEventBus.emit(event, { accountId, indexedAccountId });
  } else if (event === EAppEventBusNames.GlobalDeriveTypeUpdate) {
    appEventBus.emit(event, { networkImpl: 'btc' });
  } else {
    appEventBus.emit(event, undefined);
  }
}

describe('selector snapshot removal owner', () => {
  beforeAll(registerSwapTokenSelectorCacheInvalidation);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(jest.fn());
    platformEnv.isDesktop = true;
    mockFlush.mockClear();
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    const cached: Record<string, unknown> = { unrelated: { keep: true } };
    for (const storeName of stores) {
      cached[`store:${storeName}::${cacheKeys[0]}`] = snapshot;
      cached[`store:${storeName}::${cacheKeys[1]}`] = {
        [aggregateKey]: [token],
      };
    }
    mockSnapshotRaw = JSON.stringify(cached);
    globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = { ...cached };
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jotaiContextStore.storeCache.clear();
    jotaiContextStore.storeResetRequests.clear();
    delete globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__;
    jest.restoreAllMocks();
  });

  it.each(
    (
      [
        EAppEventBusNames.WalletRemove,
        EAppEventBusNames.AccountRemove,
        EAppEventBusNames.WalletClear,
        EAppEventBusNames.GlobalDeriveTypeUpdate,
      ] as const
    ).flatMap((event) => [false, true].map((mounted) => ({ event, mounted }))),
  )(
    'clears the shared owner and four legacy scopes on $event before notifying consumers (mounted=$mounted)',
    async ({ event, mounted }) => {
      const epoch = getSwapTokenSelectorCacheEpoch();
      const liveStores = mounted
        ? stores.map((storeName) =>
            storeName === EJotaiContextStoreNames.swapTokenSelector
              ? getSwapTokenSelectorStore()
              : jotaiContextStore.getOrCreateStore({ storeName }),
          )
        : [];
      for (const store of liveStores) {
        store.set(swapTokenMapAtom(), snapshot);
        store.set(swapAllNetworkTokenListMapAtom(), {
          [aggregateKey]: [token],
        });
        store.set(swapTokenFetchingAtom(), true);
        store.set(swapTokenListRequestsAtom(), {
          [queryKey]: {
            promise: Promise.resolve([token]),
            identityVersion: epoch.identity,
            refreshVersion: epoch.refresh,
            pendingRefresh: false,
          },
        });
        store.set(swapAllNetworkActionLockAtom(), {
          [aggregateKey]: {
            activeRequestKey: 'pending',
            completionPromise: Promise.resolve(),
          },
        });
        store.set(swapAllNetworkTokenListStatusAtom(), {
          [aggregateKey]: {
            requestKey: 'pending',
            status: 'success',
            updatedAt: 1,
            identityVersion: epoch.identity,
            refreshVersion: epoch.refresh,
          },
        });
      }
      // A pending generic flush must not re-create the just-removed disk slot.
      await writeContextAtomColdStartCacheValues({
        entries: stores.flatMap((storeName) =>
          cacheKeys.map((coldStartCacheKey) => ({
            coldStartScopeKey: `store:${storeName}`,
            coldStartCacheKey,
            value:
              coldStartCacheKey === cacheKeys[0]
                ? snapshot
                : { [aggregateKey]: [token] },
          })),
        ),
      });
      const observed = jest.fn(() => {
        for (const store of liveStores) {
          expect(store.get(swapTokenMapAtom()).tokenCatch).toBeUndefined();
          expect(store.get(swapAllNetworkTokenListMapAtom())).toEqual({});
          expect(store.get(swapTokenListRequestsAtom())).toEqual({});
          expect(store.get(swapTokenFetchingAtom())).toBe(false);
          expect(store.get(swapAllNetworkActionLockAtom())).toEqual({});
          expect(store.get(swapAllNetworkTokenListStatusAtom())).toEqual({});
        }
        expect(JSON.parse(mockSnapshotRaw ?? '{}')).toEqual({
          unrelated: { keep: true },
        });
        for (const storeName of stores) {
          for (const key of cacheKeys) {
            expect(
              globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__?.[
                `store:${storeName}::${key}`
              ],
            ).toBeUndefined();
          }
        }
      });
      const unsubscribe = subscribeSwapTokenSelectorCache(observed);
      try {
        mockFlush.mockClear();
        emitRemoval(event);
        expect(observed).toHaveBeenCalledTimes(1);
        expect(getSwapTokenSelectorCacheEpoch().identity).toBe(
          epoch.identity + 1,
        );
        await Promise.resolve();
        expect(mockFlush).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(3000);
        // A later unrelated RMW flush must not restore an old runtime value.
        await writeContextAtomColdStartCacheValues({
          entries: [
            {
              coldStartScopeKey: 'store:unrelated',
              coldStartCacheKey:
                CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTipsStateAtom,
              value: { keep: true },
            },
          ],
          flushImmediately: true,
        });
        const persisted = JSON.parse(mockSnapshotRaw ?? '{}') as Record<
          string,
          unknown
        >;
        expect(persisted).toEqual({
          unrelated: { keep: true },
          [`store:unrelated::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTipsStateAtom}`]:
            { keep: true },
        });
        for (const storeName of stores) {
          for (const key of cacheKeys) {
            expect(
              globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__?.[
                `store:${storeName}::${key}`
              ],
            ).toBeUndefined();
          }
        }
        jotaiContextStore.storeCache.clear();
        for (const storeName of stores) {
          const coldStore = jotaiContextStore.prepareStoreForImmediateUse({
            storeName,
          });
          expect(coldStore.get(swapTokenMapAtom()).tokenCatch).toBeUndefined();
          expect(coldStore.get(swapAllNetworkTokenListMapAtom())).toEqual({});
        }
      } finally {
        unsubscribe();
      }
    },
  );

  it('clears old derive snapshots without retiring the current owner', () => {
    const owner = 'hd-derive-cache--0';
    const store = getSwapTokenSelectorStore();
    store.set(swapAllNetworkTokenListMapAtom(), {
      [`${owner}__Swap__usd`]: [token],
    });
    expect(isSwapTokenSelectorAccountRemoved({ indexedAccountId: owner })).toBe(
      false,
    );
    appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
      networkImpl: 'btc',
    });
    expect(store.get(swapAllNetworkTokenListMapAtom())).toEqual({});
    expect(isSwapTokenSelectorAccountRemoved({ indexedAccountId: owner })).toBe(
      false,
    );
  });

  it('blocks deleted owners but permits the same ids after an explicit account creation', () => {
    appEventBus.emit(EAppEventBusNames.AccountRemove, {
      accountId: 'watching--test-removed',
      indexedAccountId: 'hd-retired-owner--0',
    });
    expect(
      isSwapTokenSelectorAccountRemoved({
        accountId: 'watching--test-removed',
      }),
    ).toBe(true);
    expect(
      isSwapTokenSelectorAccountRemoved({
        indexedAccountId: 'hd-retired-owner--0',
      }),
    ).toBe(true);
    expect(
      isSwapTokenSelectorAccountRemoved({ accountId: 'watching--survivor' }),
    ).toBe(false);
    const recreated = {
      id: 'watching--test-removed',
      indexedAccountId: 'hd-retired-owner--0',
    };
    appEventBus.emit(EAppEventBusNames.AddDBAccountsToWallet, {
      walletId: 'watching',
      accounts: [recreated as IDBAccount],
    });
    expect(
      isSwapTokenSelectorAccountRemoved({
        accountId: recreated.id,
        indexedAccountId: recreated.indexedAccountId,
      }),
    ).toBe(false);
  });

  it('retires unmounted stored owners on WalletClear without freezing future wallets', () => {
    appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
    expect(isSwapTokenSelectorAccountRemoved({ accountId })).toBe(true);
    expect(isSwapTokenSelectorAccountRemoved({ indexedAccountId })).toBe(true);
    expect(
      isSwapTokenSelectorAccountRemoved({
        indexedAccountId: 'hd-future-owner--0',
      }),
    ).toBe(false);
  });

  it.each(
    [
      EJotaiContextStoreNames.swapTokenSelector,
      EJotaiContextStoreNames.marketSwap,
      EJotaiContextStoreNames.marketSwapReview,
    ].flatMap((storeName) =>
      [false, true].map((mounted) => ({ storeName, mounted })),
    ),
  )(
    'retires owners found only in $storeName on WalletClear (mounted=$mounted)',
    ({ storeName, mounted }) => {
      const ownerPrefix = `hd-${storeName}-${mounted ? 'live' : 'disk'}`;
      const marketAccountId = `${ownerPrefix}--m/44/60/0/0/0`;
      const marketIndexedId = `${ownerPrefix}--0`;
      const pendingAccountId = `${ownerPrefix}--m/44/60/1/0/0`;
      const pendingIndexedId = `${ownerPrefix}--1`;
      const marketSnapshot: ISwapTokenListSnapshotMap = {
        version: 1,
        updatedAt: 1,
        tokenCatch: {
          [JSON.stringify({ networkId: 'evm--1', accountId: marketAccountId })]:
            {
              data: [token],
              updatedAt: 1,
            },
        },
      };
      const marketAggregate = { [`${marketIndexedId}__Swap__usd`]: [token] };
      if (mounted) {
        const store =
          storeName === EJotaiContextStoreNames.swapTokenSelector
            ? getSwapTokenSelectorStore()
            : jotaiContextStore.getOrCreateStore({ storeName });
        const epoch = getSwapTokenSelectorCacheEpoch();
        store.set(swapTokenMapAtom(), marketSnapshot);
        store.set(swapAllNetworkTokenListMapAtom(), marketAggregate);
        store.set(swapTokenListRequestsAtom(), {
          [JSON.stringify({
            networkId: 'evm--1',
            accountId: pendingAccountId,
          })]: {
            promise: Promise.resolve([token]),
            identityVersion: epoch.identity,
            refreshVersion: epoch.refresh,
            pendingRefresh: false,
          },
        });
        store.set(swapAllNetworkActionLockAtom(), {
          [`${pendingIndexedId}__Swap__usd`]: {
            activeRequestKey: 'pending',
            completionPromise: Promise.resolve(),
          },
        });
      } else {
        // Neither ordinary Swap scope contains these ids, so it cannot cover a
        // missing Market entry in the removal owner's scope list.
        const onlyMarketSnapshot = {
          [`store:${storeName}::${cacheKeys[0]}`]: marketSnapshot,
          [`store:${storeName}::${cacheKeys[1]}`]: marketAggregate,
        };
        mockSnapshotRaw = JSON.stringify(onlyMarketSnapshot);
        globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__ = { ...onlyMarketSnapshot };
      }
      expect(
        isSwapTokenSelectorAccountRemoved({ accountId: marketAccountId }),
      ).toBe(false);
      expect(
        isSwapTokenSelectorAccountRemoved({
          indexedAccountId: marketIndexedId,
        }),
      ).toBe(false);
      appEventBus.emit(EAppEventBusNames.WalletClear, undefined);
      expect(
        isSwapTokenSelectorAccountRemoved({ accountId: marketAccountId }),
      ).toBe(true);
      expect(
        isSwapTokenSelectorAccountRemoved({
          indexedAccountId: marketIndexedId,
        }),
      ).toBe(true);
      if (mounted) {
        expect(
          isSwapTokenSelectorAccountRemoved({ accountId: pendingAccountId }),
        ).toBe(true);
        expect(
          isSwapTokenSelectorAccountRemoved({
            indexedAccountId: pendingIndexedId,
          }),
        ).toBe(true);
      }
    },
  );

  it('matches removed wallet ids exactly and permits a recreated wallet', () => {
    const walletId = 'hd-exact-retired';
    const id = `${walletId}--m/44/60/0/0/0`;
    appEventBus.emit(EAppEventBusNames.WalletRemove, { walletId });
    expect(isSwapTokenSelectorAccountRemoved({ accountId: id })).toBe(true);
    expect(
      isSwapTokenSelectorAccountRemoved({
        accountId: `${walletId}-other--m/44/60/0/0/0`,
      }),
    ).toBe(false);
    appEventBus.emit(EAppEventBusNames.AddDBAccountsToWallet, {
      walletId,
      accounts: [{ id } as IDBAccount],
    });
    expect(isSwapTokenSelectorAccountRemoved({ accountId: id })).toBe(false);
  });

  it('revives an explicitly recreated indexed owner before a chain account is derived', () => {
    const id = 'hd-indexed-recreated--0';
    appEventBus.emit(EAppEventBusNames.AccountRemove, { indexedAccountId: id });
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    expect(isSwapTokenSelectorAccountRemoved({ indexedAccountId: id })).toBe(
      true,
    );
    appEventBus.emit(EAppEventBusNames.AccountUpdate, {
      createdIndexedAccountIds: [id],
    });
    expect(isSwapTokenSelectorAccountRemoved({ indexedAccountId: id })).toBe(
      false,
    );
  });
});
