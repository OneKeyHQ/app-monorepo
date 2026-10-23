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
  EJotaiContextStoreNames.swap,
  EJotaiContextStoreNames.swapModal,
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
    | EAppEventBusNames.WalletClear,
) {
  if (event === EAppEventBusNames.WalletRemove) {
    appEventBus.emit(event, { walletId: 'hd-removal-cache' });
  } else if (event === EAppEventBusNames.AccountRemove) {
    appEventBus.emit(event, { accountId, indexedAccountId });
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

  it.each([
    EAppEventBusNames.WalletRemove,
    EAppEventBusNames.AccountRemove,
    EAppEventBusNames.WalletClear,
  ] as const)(
    'clears mounted, unmounted and pending snapshots on %s before notifying consumers',
    async (event) => {
      const store = jotaiContextStore.getOrCreateStore({
        storeName: EJotaiContextStoreNames.swap,
      });
      store.set(swapTokenMapAtom(), snapshot);
      store.set(swapAllNetworkTokenListMapAtom(), { [aggregateKey]: [token] });
      store.set(swapTokenFetchingAtom(), true);
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
      const epoch = getSwapTokenSelectorCacheEpoch();
      const observed = jest.fn(() => {
        expect(store.get(swapTokenMapAtom()).tokenCatch).toBeUndefined();
        expect(store.get(swapAllNetworkTokenListMapAtom())).toEqual({});
      });
      const unsubscribe = subscribeSwapTokenSelectorCache(observed);
      try {
        emitRemoval(event);
        expect(observed).toHaveBeenCalledTimes(1);
        expect(getSwapTokenSelectorCacheEpoch().identity).toBe(
          epoch.identity + 1,
        );
        expect(store.get(swapTokenListRequestsAtom())).toEqual({});
        expect(store.get(swapTokenFetchingAtom())).toBe(false);
        expect(store.get(swapAllNetworkActionLockAtom())).toEqual({});
        expect(store.get(swapAllNetworkTokenListStatusAtom())).toEqual({});
        await Promise.resolve();
        expect(mockFlush).toHaveBeenCalledTimes(1);
        jest.advanceTimersByTime(3000);
        const persisted = JSON.parse(mockSnapshotRaw ?? '{}') as Record<
          string,
          unknown
        >;
        expect(persisted).toEqual({ unrelated: { keep: true } });
        for (const storeName of stores) {
          for (const key of cacheKeys) {
            expect(
              globalCache.__ONEKEY_CTX_ATOM_SNAPSHOT__?.[
                `store:${storeName}::${key}`
              ],
            ).toBeUndefined();
          }
        }
        const coldStore = jotaiContextStore.prepareStoreForImmediateUse({
          storeName: EJotaiContextStoreNames.swapModal,
        });
        expect(coldStore.get(swapTokenMapAtom()).tokenCatch).toBeUndefined();
        expect(coldStore.get(swapAllNetworkTokenListMapAtom())).toEqual({});
      } finally {
        unsubscribe();
      }
    },
  );

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
