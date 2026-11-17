import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { writeContextAtomColdStartCacheValues } from '@onekeyhq/kit-bg/src/states/jotai/utils';
import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { readContextAtomSnapshotRaw } from '@onekeyhq/shared/src/storage/uiSnapshotCaches';
import { parseColdStartSnapshotRaw } from '@onekeyhq/shared/src/utils/coldStartCacheSnapshotUtils';

import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';

import {
  registerSwapTokenSelectorRemoval,
  retireSwapTokenSelectorAccount,
} from './swapTokenSelectorCacheUtils';

import type { IJotaiContextStore } from '../../../states/jotai/utils/createJotaiContext';

const SWAP_STORE_NAMES = [
  EJotaiContextStoreNames.swapTokenSelector,
  EJotaiContextStoreNames.swap,
  EJotaiContextStoreNames.swapModal,
  EJotaiContextStoreNames.marketSwap,
  EJotaiContextStoreNames.marketSwapReview,
] as const;

let registered = false;
let clearStoreCache:
  | ((store: IJotaiContextStore) => {
      tokenMap: unknown;
      requests: unknown;
      aggregateMap: unknown;
      aggregateLocks: unknown;
    })
  | undefined;

// The selector data owner supplies the atom references when it loads. Startup
// cache removal must not eagerly import Swap's business/UI module graph.
export function registerSwapTokenSelectorStoreInvalidation(
  clear: NonNullable<typeof clearStoreCache>,
) {
  clearStoreCache = clear;
}

function retireSnapshotAccounts(value: unknown) {
  if (!value || typeof value !== 'object') return;
  const { tokenCatch } = value as { tokenCatch?: Record<string, unknown> };
  for (const key of Object.keys(tokenCatch ?? {})) {
    try {
      const params = JSON.parse(key) as { accountId?: unknown };
      if (typeof params.accountId === 'string')
        retireSwapTokenSelectorAccount(params.accountId);
    } catch {
      // Invalid snapshot rows are not usable token-list cache entries.
    }
  }
}

function retireAggregateAccounts(value: unknown) {
  if (!value || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    const accountId = key.split('__')[0];
    if (accountId && accountId !== 'noAccountId')
      retireSwapTokenSelectorAccount(accountId);
  }
}

/** The UI runtime owns these display snapshots, including scopes not mounted. */
export function registerSwapTokenSelectorCacheInvalidation() {
  if (registered) return;
  registered = true;

  const clear = (retireOwners = false) => {
    if (retireOwners) {
      try {
        const snapshot = parseColdStartSnapshotRaw(
          readContextAtomSnapshotRaw(),
        );
        for (const storeName of SWAP_STORE_NAMES) {
          const scope = `store:${storeName}::`;
          retireSnapshotAccounts(
            snapshot?.[
              `${scope}${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`
            ],
          );
          retireAggregateAccounts(
            snapshot?.[
              `${scope}${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom}`
            ],
          );
        }
      } catch {
        // A corrupt/unavailable disk cache must not prevent clearing live data.
      }
    }
    for (const storeName of SWAP_STORE_NAMES) {
      const store = jotaiContextStore.getStore({ storeName });
      if (store) {
        const previous = clearStoreCache?.(store);
        if (retireOwners) {
          retireSnapshotAccounts(previous?.tokenMap);
          retireSnapshotAccounts({ tokenCatch: previous?.requests });
          retireAggregateAccounts(previous?.aggregateMap);
          retireAggregateAccounts(previous?.aggregateLocks);
        }
      }
    }

    // Clear the generic flusher's pending value as well as disk, or its next
    // debounce/AppState flush could restore the deleted owner's snapshot.
    void writeContextAtomColdStartCacheValues({
      entries: SWAP_STORE_NAMES.flatMap((storeName) =>
        [
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom,
          CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapAllNetworkTokenListMapAtom,
        ].map((coldStartCacheKey) => ({
          coldStartScopeKey: `store:${storeName}`,
          coldStartCacheKey,
          value: undefined,
        })),
      ),
      flushImmediately: true,
    }).catch(() => undefined);
  };

  registerSwapTokenSelectorRemoval(clear);
}
