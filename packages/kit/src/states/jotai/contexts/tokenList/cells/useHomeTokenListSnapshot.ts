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

import { buildOverviewOwnerKey } from '../../accountOverview/atoms';
import { useActiveAccount } from '../../accountSelector';
import { useListStructureAtom } from '../atoms';

export interface IHomeTokenListSnapshot {
  tokens: IAccountToken[];
  keys: string;
  map: Record<string, ITokenFiat>;
  /** SETTLED owner identity from the BG VM (lags on purpose, design C-F1). */
  accountId: string | undefined;
  networkId: string | undefined;
}

const EMPTY_SNAPSHOT: IHomeTokenListSnapshot = {
  tokens: [],
  keys: '',
  map: {},
  accountId: undefined,
  networkId: undefined,
};

/**
 * Reactive snapshot of the merged home raw list + full fiat map, PULLed from the
 * BG ViewModel and refreshed on every home structure frame. `num` selects the
 * account-selector slot (defaults to the home slot 0).
 */
export function useHomeTokenListSnapshot(num = 0): IHomeTokenListSnapshot {
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num });
  // Reactive trigger: bumps only on a structure frame (not price ticks), so the
  // snapshot re-pulls when the home list membership/structure changes.
  const [listStructure] = useListStructureAtom();

  const ownerKey = buildOverviewOwnerKey(account?.id, network?.id);

  // Reactive trigger consumed as a dep below: bumps only on a structure frame
  // (not price ticks), so the snapshot re-pulls when the home list changes.
  const structureGeneration = listStructure.generation;

  const { result } = usePromiseResult(
    async (): Promise<IHomeTokenListSnapshot> => {
      // Reference the trigger so the dep is "used" (the value itself is not
      // needed in the body — the re-pull on its change is the whole point).
      void structureGeneration;
      if (!ownerKey) {
        return EMPTY_SNAPSHOT;
      }
      const [raw, map] = await Promise.all([
        backgroundApiProxy.serviceTokenViewModel.getRawTokenList({ ownerKey }),
        backgroundApiProxy.serviceTokenViewModel.getAllTokenListMap({
          ownerKey,
        }),
      ]);
      return {
        tokens: raw.tokens,
        keys: raw.keys,
        map,
        accountId: raw.accountId,
        networkId: raw.networkId,
      };
    },
    [ownerKey, structureGeneration],
    {
      initResult: EMPTY_SNAPSHOT,
      checkIsFocused: false,
    },
  );

  return useMemo(() => result ?? EMPTY_SNAPSHOT, [result]);
}
