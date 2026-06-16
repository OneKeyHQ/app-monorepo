/**
 * TokenList cells — reactive per-network sub-token fiat map for the aggregate
 * badge / icon / auto-select check (design 2026-06-16 §R2+R3, red-team C-F2 /
 * completeness-#3, BLOCKING).
 *
 * `checkIsOnlyOneTokenHasBalance` (tokenUtils) iterates an aggregate's OWNED
 * per-network sub-tokens and reads `map[subToken.$key].fiatValue`. Those keys
 * are per-network SUB-token `$key`s — NOT the aggregate `$key`. The summed
 * `aggCell` therefore CANNOT serve them (it is keyed by the aggregate `$key` and
 * sums across networks); reading it would make every badge / network icon /
 * auto-select decision wrong. This hook builds the small `subTokenKey ->
 * ITokenFiat` slice the check needs, sourced from the per-network SUB-cells
 * (`subcell(store, aggKey, networkId)`), which is exactly where the valuation
 * frame writes aggregate sub-token fiat.
 *
 * On the HOME cell-seam path it reads the live sub-cells reactively (a price
 * tick on a member re-renders only this consumer). On the NON-cell paths
 * (AssetList host / scoped active-account), the host fills the whole
 * `tokenListMap` in context (which already carries the per-network sub-token
 * `$key` fiat), so the hook returns that map directly.
 */
import { useMemo } from 'react';

import { atom, useAtomValue } from 'jotai';

import type { ITokenKey } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { useTokenListContextData } from '../atoms';

import { subcell } from './projection';

import type { IJotaiContextStore } from '../../../utils/createJotaiContext';
import type { Atom } from 'jotai';

const EMPTY_MAP: Record<string, ITokenFiat> = {};

/**
 * Pure builder for the derived atom: reads each owned sub-token's per-network
 * SUB-cell (`subcell(store, aggKey, subToken.networkId)`) and assembles the
 * `subTokenKey -> ITokenFiat` slice. Exported (and store-injected) so it can be
 * unit-tested against a node `createStore()` without React. The F2 guard lives
 * here: the keys are the per-network SUB-token `$key`s, the lookups are the
 * per-network sub-cells — never the summed aggregate cell.
 */
export function buildAggregateSubTokenFiatAtom(params: {
  store: IJotaiContextStore;
  aggKey: ITokenKey;
  aggregateTokenList: IAccountToken[];
}): Atom<Record<string, ITokenFiat>> {
  const { store, aggKey, aggregateTokenList } = params;
  return atom((get) => {
    const map: Record<string, ITokenFiat> = {};
    for (const subToken of aggregateTokenList) {
      const fiat = get(subcell(store, aggKey, subToken.networkId ?? ''));
      if (fiat) {
        map[subToken.$key] = fiat;
      }
    }
    return map;
  });
}

/**
 * Build the `subTokenKey -> ITokenFiat` map for ONE aggregate's owned
 * sub-tokens, reading the live per-network sub-cells reactively.
 *
 * @param aggKey         the aggregate row `$key` (the parent key the sub-cells
 *                       are grouped under).
 * @param aggregateTokenList the OWNED per-network sub-tokens of the aggregate.
 * @param useCellSeam    home cell-seam marker (from TokenListViewContext).
 * @param contextTokenListMap the host-provided whole fiat map (non-cell paths);
 *                       returned as-is when the cell seam is off.
 */
export function useAggregateSubTokenFiatMap({
  aggKey,
  aggregateTokenList,
  useCellSeam,
  contextTokenListMap,
}: {
  aggKey: ITokenKey;
  aggregateTokenList: IAccountToken[];
  useCellSeam: boolean | undefined;
  contextTokenListMap: Record<string, ITokenFiat> | undefined;
}): Record<string, ITokenFiat> {
  // `useTokenListContextData` returns the optional store; it is always defined
  // inside a mounted token-list store, which is guaranteed on every path that
  // renders these leaves.
  const store = useTokenListContextData().store;

  // A single derived atom that reads every member's per-network sub-cell and
  // assembles the `subTokenKey -> ITokenFiat` slice. Because jotai re-tracks
  // deps on each eval, a price tick on any member sub-cell recomputes ONLY this
  // atom (and re-renders only this consumer). Rebuilt only when the member set
  // (its `$key`s) or the aggregate key changes — both structure-tier, stable
  // across price ticks. A single `useAtomValue` keeps the hook count stable
  // regardless of member-list length (rules-of-hooks safe).
  const memberKeysSig = aggregateTokenList
    .map((t) => `${t.$key}:${t.networkId ?? ''}`)
    .join('|');
  const derivedAtom = useMemo(
    () => {
      if (!useCellSeam || !store) {
        return atom(() => contextTokenListMap ?? EMPTY_MAP);
      }
      return buildAggregateSubTokenFiatAtom({
        store,
        aggKey,
        aggregateTokenList,
      });
    },
    // contextTokenListMap is only read on the non-cell branch; include it so a
    // host-map change re-derives. aggregateTokenList is keyed via memberKeysSig.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, aggKey, useCellSeam, memberKeysSig, contextTokenListMap],
  );

  return useAtomValue(derivedAtom, store ? { store } : undefined);
}

/**
 * Reactive fiat for ONE aggregate per-network sub-token, read from its sub-cell
 * (`subcell(store, aggKey, networkId)`). Used by AggregateTokenSelector's per-row
 * item (red-team C-F3: reactive per-row display — read the live home cell, never
 * a one-shot PULL, so a price tick updates the row while the modal is open).
 * Returns undefined outside a mounted store / when the sub-cell is empty.
 */
export function useAggregateSubTokenFiat(
  aggKey: ITokenKey,
  networkId: string | undefined,
): ITokenFiat | undefined {
  const store = useTokenListContextData().store;
  const subAtom = useMemo(
    () =>
      store
        ? subcell(store, aggKey, networkId ?? '')
        : atom<ITokenFiat | undefined>(undefined),
    [store, aggKey, networkId],
  );
  return useAtomValue(subAtom, store ? { store } : undefined);
}
