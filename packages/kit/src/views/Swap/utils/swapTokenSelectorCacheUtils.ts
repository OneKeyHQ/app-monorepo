import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type {
  IFetchTokensParams,
  ISwapTokenCatch,
} from '@onekeyhq/shared/types/swap/types';

export const SWAP_TOKEN_SELECTOR_DESKTOP_CACHE_SIZE = 100;
export const SWAP_TOKEN_SELECTOR_PRELOAD_MAX_AGE_MS = 5 * 60 * 1000;

export type ISwapTokenSelectorLoadOptions = {
  policy?: 'snapshot' | 'revalidate' | 'preload';
  background?: boolean;
  throwOnError?: boolean;
  subscriberSignal?: AbortSignal;
  priority?: 'foreground' | 'background';
  fullChainLists?: boolean;
};

export function createSwapTokenSearchSubscriptions(onUnused: () => void) {
  let subscribers = 0;
  let retained = false;
  let settled = false;
  let cancelled = false;
  const checkUnused = () => {
    // Cleanup/setup can hand the same canonical search to another effect.
    void Promise.resolve().then(() => {
      if (!settled && !cancelled && !retained && subscribers === 0) {
        cancelled = true;
        onUnused();
      }
    });
  };
  return {
    get cancelled() {
      return cancelled;
    },
    complete() {
      settled = true;
    },
    wait<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T | undefined> {
      if (!signal) {
        retained = true;
        return promise;
      }
      if (signal.aborted) {
        checkUnused();
        return Promise.resolve(undefined);
      }
      subscribers += 1;
      return new Promise<T | undefined>((resolve, reject) => {
        let listening = true;
        const release = () => {
          if (!listening) return;
          listening = false;
          subscribers -= 1;
          checkUnused();
        };
        const abort = () => {
          release();
          resolve(undefined);
        };
        signal.addEventListener('abort', abort, { once: true });
        void promise.then(
          (value) => {
            signal.removeEventListener('abort', abort);
            release();
            resolve(value);
          },
          (error: unknown) => {
            signal.removeEventListener('abort', abort);
            release();
            reject(error);
          },
        );
      });
    },
  };
}

export type ISwapTokenSearchSubscriptions = ReturnType<
  typeof createSwapTokenSearchSubscriptions
>;

// These versions invalidate every Swap store, including selectors that were
// closed when a transaction settled or the wallet's derivation changed.
let cacheEpoch = { refresh: 0, identity: 0 };
const listeners = new Set<() => void>();
let removalListener: ((clearAll: boolean) => void) | undefined;
const removedWalletIds = new Set<string>();
const removedAccountIds = new Set<string>();

export function retireSwapTokenSelectorAccount(accountId: string) {
  removedAccountIds.add(accountId);
}

export function isSwapTokenSelectorAccountRemoved({
  accountId,
  indexedAccountId,
}: {
  accountId?: string;
  indexedAccountId?: string;
}) {
  return [accountId, indexedAccountId].some(
    (id) =>
      id &&
      (removedAccountIds.has(id) ||
        removedWalletIds.has(
          accountUtils.getWalletIdFromAccountId({ accountId: id }),
        )),
  );
}

function invalidate(identityChanged: boolean, clearAll?: boolean) {
  cacheEpoch = {
    refresh: cacheEpoch.refresh + 1,
    identity: cacheEpoch.identity + (identityChanged ? 1 : 0),
  };
  if (clearAll !== undefined) removalListener?.(clearAll);
  listeners.forEach((listener) => listener());
}

export function invalidateUrlAccountTokenSelectorCache() {
  invalidate(true, false);
}

appEventBus.on(EAppEventBusNames.SwapTxHistoryStatusUpdate, () =>
  invalidate(false),
);
appEventBus.on(EAppEventBusNames.HistoryTxStatusChanged, () =>
  invalidate(false),
);
appEventBus.on(EAppEventBusNames.GlobalDeriveTypeUpdate, () =>
  invalidate(true, false),
);
appEventBus.on(EAppEventBusNames.WalletClear, () => invalidate(true, true));
appEventBus.on(EAppEventBusNames.WalletRemove, ({ walletId }) => {
  removedWalletIds.add(walletId);
  invalidate(true, false);
});
appEventBus.on(EAppEventBusNames.AccountRemove, (payload) => {
  if (payload?.accountId) retireSwapTokenSelectorAccount(payload.accountId);
  if (payload?.indexedAccountId)
    retireSwapTokenSelectorAccount(payload.indexedAccountId);
  invalidate(true, false);
});
appEventBus.on(
  EAppEventBusNames.AddDBAccountsToWallet,
  ({ walletId, accounts }) => {
    let revived = removedWalletIds.delete(walletId);
    for (const account of accounts) {
      revived = removedAccountIds.delete(account.id) || revived;
      if (account.indexedAccountId)
        revived = removedAccountIds.delete(account.indexedAccountId) || revived;
    }
    if (revived) invalidate(true);
  },
);
appEventBus.on(EAppEventBusNames.AccountUpdate, (payload) => {
  let revived = false;
  for (const id of payload?.createdIndexedAccountIds ?? []) {
    revived = removedAccountIds.delete(id) || revived;
    revived =
      removedWalletIds.delete(
        accountUtils.getWalletIdFromAccountId({ accountId: id }),
      ) || revived;
  }
  if (revived) invalidate(true);
});

export function getSwapTokenSelectorCacheEpoch() {
  return cacheEpoch;
}

export function subscribeSwapTokenSelectorCache(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function registerSwapTokenSelectorRemoval(
  listener: (clearAll: boolean) => void,
) {
  removalListener = listener;
}

export function buildSwapTokenListCacheKey(params: IFetchTokensParams) {
  // Control flags (prefetch, cancellation and error handling) do not change
  // the result. Keep every query/account/filter dimension in a stable order.
  return JSON.stringify({
    protocol: params.protocol,
    networkId: params.networkId,
    keywords: params.keywords ?? '',
    limit: params.limit ?? 50,
    accountAddress: params.accountAddress,
    accountNetworkId: params.accountNetworkId,
    accountId: params.accountId,
    onlyAccountTokens: params.onlyAccountTokens,
    onlySwapTokens: params.onlySwapTokens,
    lpToken: params.lpToken,
    currency: params.currency,
  });
}

export function isSwapTokenSelectorSnapshotCurrent(entry?: {
  refreshVersion?: number;
  identityVersion?: number;
}) {
  return (
    entry !== undefined &&
    entry.refreshVersion === cacheEpoch.refresh &&
    entry.identityVersion === cacheEpoch.identity
  );
}

export function isSwapTokenSelectorSnapshotFreshForPreload(
  entry?: ISwapTokenCatch,
  now = Date.now(),
) {
  if (!entry || !Number.isFinite(entry.updatedAt) || entry.updatedAt <= 0)
    return false;
  const age = now - entry.updatedAt;
  if (age < 0 || age >= SWAP_TOKEN_SELECTOR_PRELOAD_MAX_AGE_MS) return false;
  // Hydrated snapshots retain their real age but not process-local generations.
  // They can suppress speculative requests only before an invalidation occurs.
  return (
    isSwapTokenSelectorSnapshotCurrent(entry) ||
    (entry.persisted === true &&
      entry.refreshVersion === undefined &&
      cacheEpoch.refresh === 0 &&
      entry.identityVersion === cacheEpoch.identity)
  );
}
