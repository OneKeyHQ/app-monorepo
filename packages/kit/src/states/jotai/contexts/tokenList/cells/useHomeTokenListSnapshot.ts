/**
 * TokenList cells — home raw-list + full-fiat-map snapshot hook (design
 * 2026-06-16 §R2+R3).
 *
 * Replaces the deleted `allTokenListAtom` / `allTokenListMapAtom` reads for the
 * CALLBACK-SNAPSHOT consumers (MoreActionButton, WalletActions Send/Buy/Receive
 * /ViewInExplorer, FiatCrypto, ScanQrCode-dev, TxHistory empty-state,
 * UniversalSearch + its AccountAssetItem). Those consumers captured the whole
 * merged home list + fiat map in a closure at modal-OPEN time, then passed the
 * snapshot into a route / scanner / dialog action. With the legacy atoms gone,
 * the authoritative copy lives in the BG per-owner ViewModel and is fetched via:
 *   - `getRawTokenList()`     -> the merged-with-risky raw list (tokens + keys)
 *                                AND the SETTLED owner identity (accountId /
 *                                networkId — lags on purpose, design C-F1);
 *   - `getAllTokenListMap()`  -> the full `$key -> ITokenFiat` map, composed in
 *                                the BG as `{ ...tokenListMap, ...riskyMap,
 *                                ...flatten(aggregateTokensMap) }`.
 *
 * Both are PULL-only @backgroundMethods (the largest payloads are never pushed,
 * design §4 "推小拉大"). The hook re-pulls reactively whenever the home list
 * STRUCTURE changes — keyed on `listStructureAtom().generation` (a cheap signal
 * the BG already pushes; it bumps only on a structure frame, never on a price
 * tick). This keeps the in-component snapshot fresh without an action-time PULL,
 * so the callback closure always holds a current list even after the BG MRU has
 * evicted other owners (the home owner is always most-recently-ingested, so it
 * is never the evicted entry; design red-team R-#4 user decision).
 *
 * MUST be called inside a Home token-list store provider mirror (so
 * `useListStructureAtom` resolves) AND with an active account/network context.
 */
import { useMemo } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useListStructureAtom } from '../atoms';

import { useHomeTokenListOwnerKey } from './useHomeTokenListOwnerKey';

export interface IHomeTokenListSnapshot {
  tokens: IAccountToken[];
  keys: string;
  map: Record<string, ITokenFiat>;
  /** Owner/generation cache key for guarding stale usePromiseResult values. */
  cacheKey: string;
  /** Request ownerKey used for this pull. */
  ownerKey: string;
  /** SETTLED owner identity from the BG VM (lags on purpose, design C-F1). */
  accountId: string | undefined;
  networkId: string | undefined;
}

const EMPTY_SNAPSHOT: IHomeTokenListSnapshot = {
  tokens: [],
  keys: '',
  map: {},
  cacheKey: '',
  ownerKey: '',
  accountId: undefined,
  networkId: undefined,
};

/**
 * Module-level inflight/result cache so the N home consumers that all call this
 * hook (Send/Receive/Buy/ViewInExplorer/More/TxHistory/...) collapse onto ONE
 * pair of PULLs per `(ownerKey, generation)` instead of each firing its own.
 * Keyed by `ownerKey@generation`; a new key supersedes (and evicts) every older
 * one, so the map holds a single entry and never grows. A rejected pull is
 * dropped so the next consumer retries instead of inheriting a pinned failure.
 */
const snapshotInflight = new Map<string, Promise<IHomeTokenListSnapshot>>();

function fetchHomeTokenListSnapshot(
  ownerKey: string,
  generation: number,
): Promise<IHomeTokenListSnapshot> {
  const cacheKey = `${ownerKey}@${generation}`;
  let pending = snapshotInflight.get(cacheKey);
  if (!pending) {
    pending = Promise.all([
      backgroundApiProxy.serviceTokenViewModel.getRawTokenList({ ownerKey }),
      backgroundApiProxy.serviceTokenViewModel.getAllTokenListMap({ ownerKey }),
    ])
      .then(([raw, map]) => ({
        tokens: raw.tokens,
        keys: raw.keys,
        map,
        cacheKey,
        ownerKey,
        accountId: raw.accountId,
        networkId: raw.networkId,
      }))
      .catch((e) => {
        snapshotInflight.delete(cacheKey);
        throw e;
      });
    // Single-entry cache: evict any stale `(ownerKey, generation)` so a switch
    // never leaves an old snapshot pinned.
    for (const key of snapshotInflight.keys()) {
      snapshotInflight.delete(key);
    }
    snapshotInflight.set(cacheKey, pending);
  }
  return pending;
}

/**
 * Reactive snapshot of the merged home raw list + full fiat map, PULLed from the
 * BG ViewModel and refreshed on every home structure frame. `num` selects the
 * account-selector slot (defaults to the home slot 0).
 */
export function useHomeTokenListSnapshot(num = 0): IHomeTokenListSnapshot {
  // Reactive trigger: bumps only on a structure frame (not price ticks), so the
  // snapshot re-pulls when the home list membership/structure changes.
  const [listStructure] = useListStructureAtom();

  // Single source of truth for the BG per-owner key — IDENTICAL to the key the
  // `ingestRound` WRITE side (TokenListBlock) uses, including the merge-derive
  // `indexedAccountId` axis. Computing it anywhere else risks a write/read drift
  // that silently misses the BG entry and returns EMPTY.
  const ownerKey = useHomeTokenListOwnerKey(num);

  // Reactive trigger consumed as a dep below: bumps only on a structure frame
  // (not price ticks), so the snapshot re-pulls when the home list changes.
  const structureGeneration = listStructure.generation;
  const expectedCacheKey = ownerKey ? `${ownerKey}@${structureGeneration}` : '';

  const { result } = usePromiseResult(
    async (): Promise<IHomeTokenListSnapshot> => {
      if (!ownerKey) {
        return EMPTY_SNAPSHOT;
      }
      // Shared inflight/result cache (above) collapses the N home consumers'
      // identical PULLs for this `(ownerKey, generation)` into one round-trip
      // pair; `structureGeneration` is the cache axis (it bumps only on a
      // structure frame, never on a price tick).
      return fetchHomeTokenListSnapshot(ownerKey, structureGeneration);
    },
    [ownerKey, structureGeneration],
    {
      initResult: EMPTY_SNAPSHOT,
      checkIsFocused: false,
    },
  );

  return useMemo(
    () => (result?.cacheKey === expectedCacheKey ? result : EMPTY_SNAPSHOT),
    [expectedCacheKey, result],
  );
}
