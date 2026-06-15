/**
 * TokenList SLC — PRODUCER WIRING (spec §4.1, §6, §3.1 agg channel).
 *
 * The single write path into `listStructureAtom` + the per-key cells (spec
 * §4.1: "唯一写入口 = producer 调 apply"). Phase-1 the producer lives on the
 * home `TokenListBlock`; this hook is what it mounts.
 *
 * Design (Phase-1, mount-bound single writer — spec §2, §6):
 *   - The existing `refresh*` writers (refreshTokenList / refreshTokenListMap /
 *     refreshSmallBalance* / refreshAggregateTokensMap / refreshRisky* /
 *     refreshAllTokenList*) stay EXACTLY as they are; none are removed. They
 *     remain the whole-object source after each fetch round (risky /
 *     allTokenList intentionally untouched — the `ownerMismatch` gate reads
 *     `allTokenList.accountId/networkId`, spec §6).
 *   - This producer OBSERVES the already-settled atoms (`tokenListAtom`,
 *     `smallBalanceTokenListAtom`, `tokenListMapAtom`, `aggregateTokensMapAtom`,
 *     `smallBalanceTokensFiatValueAtom`) and, from the SAME fetch round those
 *     writers landed, derives a structure frame + a valuation frame via
 *     `buildFrames`, then calls `applyStructureSnapshot` / `applyValuationFrame`.
 *   - Observing the settled atoms (rather than rewriting all ~85 leading-edge
 *     refresh call sites individually) means the producer covers every refresh
 *     round — the `run` poll, the throttled all-network flush, clearAll, the
 *     local-cache hydrate, the main settle, and the cold-start hydrate — from a
 *     single seam, without touching the risky/allTokenList settle coupling.
 *   - Sorting stays in the UI for Phase-1 (spec §1, §6#4) but the structure
 *     derivation is THROTTLED (~500ms, trailing) so a price-tick storm does not
 *     re-derive ids on every tick. The valuation frame is applied promptly
 *     (cell writes are O(changed) via fiatEqual, spec §11.2).
 *   - structure frame ONLY on a structural change; a pure price tick yields no
 *     structure frame (`buildFrames` returns `structure: undefined`) so
 *     `listStructureAtom` stays low-frequency (spec §4.1).
 *
 * The hook holds no business logic itself — all derivation is in the pure
 * `buildFrames` (spec §11.5); this is a thin jotai/React shell.
 */
import { useEffect, useMemo, useRef } from 'react';

import { useThrottledCallback } from 'use-debounce';

import {
  buildFrames,
  metaByKeyFromTokens,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/buildFrames';
import type { IBuildFramesPrev } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/buildFrames';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/pure';
import type { ITokenKey } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/types';
import type {
  ICustomTokenItem,
  IHomeDefaultToken,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  aggregateTokensMapAtom,
  listStructureAtom,
  smallBalanceTokenListAtom,
  smallBalanceTokensFiatValueAtom,
  tokenListAtom,
  tokenListMapAtom,
  useTokenListContextData,
} from '../atoms';

import {
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from './apply';
import { persistSlimColdCache } from './coldStart';
import {
  aggCell,
  cell,
  clearAll,
  ensureStoreProjection,
  meta,
  resolveCurrentStore,
  resolveStoreData,
  subcell,
} from './projection';

import type { IJotaiContextStore } from '../../../utils/createJotaiContext';

const STRUCTURE_THROTTLE_MS = 500;

/**
 * Build the `IBuildFramesPrev` snapshot from the store's current
 * `listStructureAtom` + the cached scalar + the previously-applied metas.
 */
function readPrev(
  store: IJotaiContextStore,
  prevScalar: string,
  prevMetaByKey: Record<ITokenKey, IToken | undefined>,
): IBuildFramesPrev {
  const structure = store.get(listStructureAtom());
  return {
    structure: {
      orderedIds: structure.orderedIds,
      smallBalanceIds: structure.smallBalanceIds,
      nonZeroIds: structure.nonZeroIds,
      aggMembership: structure.aggMembership,
      ownerKey: structure.ownerKey,
      generation: structure.generation,
    },
    smallBalanceFiatValue: prevScalar,
    metaByKey: prevMetaByKey,
  };
}

/**
 * Producer hook. Call once from the home `TokenListBlock`, passing the current
 * `${accountId}__${networkId}` owner key and the current settings currency id.
 * Returns nothing — it wires the SLC apply path off the settled atoms and, on
 * each structural change, persists the slim cold-start bundle (spec §7 落盘).
 */
/**
 * hideZero "keep default zero-balance" inputs (spec §8#2, PR-S Step 3). The
 * home producer threads these so the structure frame's `nonZeroIds` is the
 * AUTHORITATIVE hideZero membership (full 3-branch computeNonZeroIds), not
 * balance-only. They are read inside the throttled flush via refs so a change
 * to them does not rebuild the throttled callback.
 */
export interface ITokenListSlcProducerNonZeroInputs {
  keepDefault?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
}

export function useTokenListSlcProducer(
  ownerKey: string,
  currencyId: string,
  nonZeroInputs?: ITokenListSlcProducerNonZeroInputs,
): void {
  const { store } = useTokenListContextData();

  // Stable deps bag bound to this store. `meta/cell/subcell/aggCell` resolve the
  // SAME per-store projection the leaves read (via the WeakMap), so the producer
  // and `useTokenFiat` share one cell registry.
  const deps = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const s = store!;
    return buildApplyDeps({
      store: s,
      listStructureAtom: listStructureAtom(),
      resolveCurrentStore,
      fiatEqual,
      metaEqual,
      isAgg,
      clearAll,
      shallowEqual: shallowEqualArray,
      meta,
      cell,
      subcell,
      aggCell,
    });
  }, [store]);

  // Previously-applied scalar + metas, for structure-change detection. Kept in
  // refs because they are producer-internal bookkeeping, not render state.
  const prevScalarRef = useRef<string>('0');
  const prevMetaByKeyRef = useRef<Record<ITokenKey, IToken | undefined>>({});
  // Current settings currency id, read inside the throttled flush via a ref so
  // a currency switch doesn't need to rebuild the throttled callback. The slim
  // cold-start bundle stores this currency for the T0 gate (spec §7, §3#3).
  const currencyIdRef = useRef<string>(currencyId);
  currencyIdRef.current = currencyId;

  // hideZero default-keep inputs, read inside the throttled flush via a ref so
  // they don't rebuild the throttled callback (spec §8#2, PR-S Step 3).
  const nonZeroInputsRef = useRef<ITokenListSlcProducerNonZeroInputs>(
    nonZeroInputs ?? {},
  );
  nonZeroInputsRef.current = nonZeroInputs ?? {};

  // The actual derive+apply, run on the trailing edge of the throttle window so
  // a price-tick storm coalesces into one structure derivation per ~500ms while
  // the valuation cells still take every settled value (spec §1, §4.1).
  const flush = useThrottledCallback(
    () => {
      // No owner yet (account/network not resolved) — nothing to project.
      if (!ownerKey) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const s = store!;
      const storeData = resolveStoreData(s);
      if (!storeData) {
        return;
      }
      // Identity check up front — if the store was reset/recreated, bail (apply
      // would also drop it, but this avoids the work).
      if (resolveCurrentStore(storeData) !== s) {
        return;
      }

      ensureStoreProjection(s);

      const orderedTokens = s.get(tokenListAtom()).tokens;
      const smallBalanceTokens = s.get(
        smallBalanceTokenListAtom(),
      ).smallBalanceTokens;
      const tokenListMap: Record<ITokenKey, ITokenFiat> =
        s.get(tokenListMapAtom());
      const aggregateTokensMap = s.get(aggregateTokensMapAtom());
      const smallBalanceFiatValue = s.get(smallBalanceTokensFiatValueAtom());

      const prev = readPrev(s, prevScalarRef.current, prevMetaByKeyRef.current);

      const { structure, valuation } = buildFrames(
        {
          orderedTokens,
          smallBalanceTokens,
          tokenListMap,
          aggregateTokensMap,
          smallBalanceFiatValue,
          ownerKey,
          storeData,
          keepDefault: nonZeroInputsRef.current.keepDefault,
          homeDefaultTokenMap: nonZeroInputsRef.current.homeDefaultTokenMap,
          customTokens: nonZeroInputsRef.current.customTokens,
        },
        prev,
      );

      // Structure first so new cells exist before the valuation self-heals them
      // (spec §4 ensures sub-cells; §4.1 valuation always carries the full
      // current map). React 18 auto-batches the resulting state updates inside
      // this timer callback, so leaves re-render once per flush.
      const projection = ensureStoreProjection(s);
      if (structure) {
        applyStructureSnapshot(s, projection, structure, deps);
      }
      applyValuationFrame(s, projection, valuation, deps, (fn) => fn());

      // Record what we just applied for the next structure-change comparison.
      // Persist the slim cold-start bundle ONLY on a structural change (content
      // actually moved) — pure price ticks (structure === undefined) skip the
      // write so the main-thread RMW stays low-frequency (spec §7 落盘).
      if (structure) {
        prevScalarRef.current = smallBalanceFiatValue;
        prevMetaByKeyRef.current = metaByKeyFromTokens([
          ...orderedTokens,
          ...smallBalanceTokens,
        ]);
        persistSlimColdCache({
          store: s,
          projection,
          currency: currencyIdRef.current,
        });
      }
    },
    STRUCTURE_THROTTLE_MS,
    { leading: false, trailing: true },
  );

  // Re-run the producer whenever any settled atom changes. We subscribe to the
  // five atoms and schedule a throttled flush; the throttle absorbs the burst of
  // writes a single fetch round produces (refreshTokenList + refreshTokenListMap
  // + refreshSmallBalance* + refreshAggregateTokensMap all fire back to back).
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const s = store!;
    const schedule = () => {
      flush();
    };
    // Prime once on mount (cold-start hydrate / cache hydrate may have already
    // landed before this effect runs).
    schedule();
    const unsubs = [
      s.sub(tokenListAtom(), schedule),
      s.sub(smallBalanceTokenListAtom(), schedule),
      s.sub(tokenListMapAtom(), schedule),
      s.sub(aggregateTokensMapAtom(), schedule),
      s.sub(smallBalanceTokensFiatValueAtom(), schedule),
    ];
    return () => {
      flush.cancel();
      unsubs.forEach((u) => u());
    };
  }, [store, flush, ownerKey]);
}
