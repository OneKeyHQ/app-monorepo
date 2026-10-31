// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { useAtom } from 'jotai';

import { registerSwapTokenSelectorStoreInvalidation } from '@onekeyhq/kit/src/views/Swap/utils/swapTokenSelectorCacheInvalidation';
import {
  type ISwapTokenSearchSubscriptions,
  getSwapTokenSelectorCacheEpoch,
} from '@onekeyhq/kit/src/views/Swap/utils/swapTokenSelectorCacheUtils';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import {
  readContextAtomColdStartCacheValues,
  writeContextAtomColdStartCacheValues,
} from '@onekeyhq/kit-bg/src/states/jotai/utils';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { sanitizeSwapTokenListSnapshot } from '@onekeyhq/shared/src/utils/swapTokenSelectorSnapshotUtils';
import {
  ESwapTabSwitchType,
  type ISwapToken,
  type ISwapTokenListSnapshotMap,
} from '@onekeyhq/shared/types/swap/types';

import { createJotaiContext } from '../../utils/createJotaiContext';
import { jotaiContextStore } from '../../utils/jotaiContextStore';

import type { IJotaiContextStore } from '../../utils/createJotaiContext';

const { contextAtom } = createJotaiContext();
export const SWAP_TOKEN_SELECTOR_STORE =
  EJotaiContextStoreNames.swapTokenSelector;
export const SWAP_TOKEN_SELECTOR_SCOPE = `store:${SWAP_TOKEN_SELECTOR_STORE}`;
export const SWAP_TOKEN_SELECTOR_LEGACY_STORES = [
  EJotaiContextStoreNames.swap,
  EJotaiContextStoreNames.swapModal,
  EJotaiContextStoreNames.marketSwap,
  EJotaiContextStoreNames.marketSwapReview,
] as const;

export const sanitizeSwapTokenMapColdStartSnapshot =
  sanitizeSwapTokenListSnapshot;

const holdingsSnapshotCache = new WeakMap<
  object,
  { desktop: boolean; value: Record<string, ISwapToken[]> }
>();
function isSwapToken(value: unknown): value is ISwapToken {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'networkId' in value &&
    typeof value.networkId === 'string' &&
    'contractAddress' in value &&
    typeof value.contractAddress === 'string' &&
    'symbol' in value &&
    typeof value.symbol === 'string' &&
    'decimals' in value &&
    typeof value.decimals === 'number',
  );
}
export function sanitizeSwapTokenSelectorHoldingsSnapshot(
  value: unknown,
): Record<string, ISwapToken[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const desktop = Boolean(platformEnv.isDesktop || platformEnv.isWeb);
  const cached = holdingsSnapshotCache.get(value);
  if (cached?.desktop === desktop) return cached.value;
  const result: Record<string, ISwapToken[]> = {};
  for (const [key, tokens] of Object.entries(value)) {
    if (Array.isArray(tokens) && tokens.every(isSwapToken)) {
      const complete =
        desktop && !key.split('__').includes(ESwapTabSwitchType.STOCK);
      // Never persist a truncated desktop projection as complete sidebar membership.
      if (!complete || tokens.length <= 2000)
        result[key] = complete ? tokens : tokens.slice(0, 200);
    }
  }
  const snapshot = Object.fromEntries(Object.entries(result).slice(-3));
  holdingsSnapshotCache.set(value, { desktop, value: snapshot });
  return snapshot;
}

export const { atom: swapTokenMapAtom } =
  contextAtom<ISwapTokenListSnapshotMap>({ version: 1, updatedAt: 0 });

export const { atom: swapTokenFetchingAtom } = contextAtom<boolean>(false);

export const { atom: swapTokenListRequestsAtom } = contextAtom<
  Record<
    string,
    {
      promise: Promise<ISwapToken[]>;
      identityVersion: number;
      refreshVersion: number;
      pendingRefresh: boolean;
      searchSubscriptions?: ISwapTokenSearchSubscriptions;
    }
  >
>({});

export const { atom: swapAllNetworkTokenListMapAtom } = contextAtom<
  Record<string, ISwapToken[]>
>({});

export const { atom: swapAllNetworkActionLockAtom } = contextAtom<
  Record<
    string,
    {
      activeRequestKey: string;
      completionPromise: Promise<void>;
      pendingRequestKey?: string;
    }
  >
>({});

export const { atom: swapAllNetworkTokenListStatusAtom } = contextAtom<
  Record<
    string,
    {
      requestKey: string;
      status: 'success' | 'partial' | 'error';
      dataReady?: boolean;
      updatedAt: number;
      identityVersion: number;
      refreshVersion: number;
    }
  >
>({});

registerSwapTokenSelectorStoreInvalidation((store) => {
  const previous = {
    tokenMap: store.get(swapTokenMapAtom()),
    requests: store.get(swapTokenListRequestsAtom()),
    aggregateMap: store.get(swapAllNetworkTokenListMapAtom()),
    aggregateLocks: store.get(swapAllNetworkActionLockAtom()),
  };
  store.set(swapTokenMapAtom(), { version: 1, updatedAt: 0 });
  store.set(swapTokenListRequestsAtom(), {});
  store.set(swapTokenFetchingAtom(), false);
  store.set(swapAllNetworkActionLockAtom(), {});
  store.set(swapAllNetworkTokenListMapAtom(), {});
  store.set(swapAllNetworkTokenListStatusAtom(), {});
  return previous;
});

const initializedStores = new WeakSet<IJotaiContextStore>();
const cacheKeys = [
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom,
  CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom,
] as const;

/** UI-runtime data owner shared by every Swap entry; no form or quote state. */
export function getSwapTokenSelectorStore(): IJotaiContextStore {
  const store = jotaiContextStore.getOrCreateStore({
    storeName: SWAP_TOKEN_SELECTOR_STORE,
  });
  if (initializedStores.has(store)) return store;
  initializedStores.add(store);
  const scopes = [
    SWAP_TOKEN_SELECTOR_SCOPE,
    ...SWAP_TOKEN_SELECTOR_LEGACY_STORES.map((name) => `store:${name}`),
  ];
  const entries = scopes.flatMap((coldStartScopeKey) =>
    cacheKeys.map((coldStartCacheKey) => ({
      coldStartScopeKey,
      coldStartCacheKey,
    })),
  );
  const values = readContextAtomColdStartCacheValues(entries);
  const read = (scope: string, key: string) =>
    values[
      entries.findIndex(
        (entry) =>
          entry.coldStartScopeKey === scope && entry.coldStartCacheKey === key,
      )
    ];
  const canonicalTokens = read(SWAP_TOKEN_SELECTOR_SCOPE, cacheKeys[0]);
  const canonicalHoldings = read(SWAP_TOKEN_SELECTOR_SCOPE, cacheKeys[1]);
  let tokens: ISwapTokenListSnapshotMap = { version: 1, updatedAt: 0 };
  let holdings: Record<string, ISwapToken[]> = {};
  // Process-local identity generations cannot authenticate a snapshot after derivation/removal.
  if (getSwapTokenSelectorCacheEpoch().identity === 0) {
    if (canonicalTokens.exists)
      tokens = sanitizeSwapTokenListSnapshot(canonicalTokens.value);
    else {
      const tokenCatch: NonNullable<ISwapTokenListSnapshotMap['tokenCatch']> =
        {};
      for (const scope of scopes.slice(1)) {
        const old = sanitizeSwapTokenListSnapshot(
          read(scope, cacheKeys[0]).value,
        );
        for (const [key, entry] of Object.entries(old.tokenCatch ?? {})) {
          if (!tokenCatch[key] || tokenCatch[key].updatedAt < entry.updatedAt)
            tokenCatch[key] = entry;
        }
      }
      tokens = sanitizeSwapTokenListSnapshot({
        version: 1,
        updatedAt: 0,
        tokenCatch,
      });
    }
    if (canonicalHoldings.exists)
      holdings = sanitizeSwapTokenSelectorHoldingsSnapshot(
        canonicalHoldings.value,
      );
    else {
      // Legacy projections have no timestamp; prefer Swap deterministically and
      // treat them as display snapshots, never as proof of a completed refresh.
      for (const scope of scopes.slice(1)) {
        const old = sanitizeSwapTokenSelectorHoldingsSnapshot(
          read(scope, cacheKeys[1]).value,
        );
        for (const [key, value] of Object.entries(old))
          if (!(key in holdings)) holdings[key] = value;
      }
      holdings = sanitizeSwapTokenSelectorHoldingsSnapshot(holdings);
    }
  }
  store.set(swapTokenMapAtom(), tokens);
  store.set(swapAllNetworkTokenListMapAtom(), holdings);
  const persistedTokens = () => ({
    coldStartScopeKey: SWAP_TOKEN_SELECTOR_SCOPE,
    coldStartCacheKey: cacheKeys[0],
    value: sanitizeSwapTokenListSnapshot(store.get(swapTokenMapAtom())),
  });
  const persistedHoldings = () => ({
    coldStartScopeKey: SWAP_TOKEN_SELECTOR_SCOPE,
    coldStartCacheKey: cacheKeys[1],
    value: sanitizeSwapTokenSelectorHoldingsSnapshot(
      store.get(swapAllNetworkTokenListMapAtom()),
    ),
  });
  // One RMW retires legacy disk/global/pending values and publishes the owner.
  void writeContextAtomColdStartCacheValues({
    entries: [
      persistedTokens(),
      persistedHoldings(),
      ...scopes.slice(1).flatMap((coldStartScopeKey) =>
        cacheKeys.map((coldStartCacheKey) => ({
          coldStartScopeKey,
          coldStartCacheKey,
          value: undefined,
        })),
      ),
    ],
    flushImmediately: true,
  }).catch(() => undefined);
  store.sub(swapTokenMapAtom(), () => {
    void writeContextAtomColdStartCacheValues({
      entries: [persistedTokens()],
    }).catch(() => undefined);
  });
  store.sub(swapAllNetworkTokenListMapAtom(), () => {
    void writeContextAtomColdStartCacheValues({
      entries: [persistedHoldings()],
    }).catch(() => undefined);
  });
  return store;
}

export function useSwapTokenMapAtom() {
  return useAtom(swapTokenMapAtom(), { store: getSwapTokenSelectorStore() });
}
export function useSwapTokenFetchingAtom() {
  return useAtom(swapTokenFetchingAtom(), {
    store: getSwapTokenSelectorStore(),
  });
}
export function useSwapTokenListRequestsAtom() {
  return useAtom(swapTokenListRequestsAtom(), {
    store: getSwapTokenSelectorStore(),
  });
}
export function useSwapAllNetworkTokenListMapAtom() {
  return useAtom(swapAllNetworkTokenListMapAtom(), {
    store: getSwapTokenSelectorStore(),
  });
}
export function useSwapAllNetworkActionLockAtom() {
  return useAtom(swapAllNetworkActionLockAtom(), {
    store: getSwapTokenSelectorStore(),
  });
}
export function useSwapAllNetworkTokenListStatusAtom() {
  return useAtom(swapAllNetworkTokenListStatusAtom(), {
    store: getSwapTokenSelectorStore(),
  });
}
