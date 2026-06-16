/**
 * TokenList SLC — Phase-2 RECEIVE SHELL (design §5 PR-2, cutover; spec §9).
 *
 * H4 IS DEAD HERE. This hook NO LONGER observes the 5 settled atoms
 * (tokenListAtom / smallBalanceTokenListAtom / tokenListMapAtom /
 * aggregateTokensMapAtom / smallBalanceTokensFiatValueAtom) nor derives frames
 * via buildFrames. The BG `ServiceTokenViewModel` now owns frame production; the
 * UI is a thin receive shell that:
 *   (a) subscribes to the two BG frame events FIRST,
 *   (b) then PULLs the authoritative full frames via the @backgroundMethod
 *       `getTokenListFrames` and applies them — SUBSCRIBE-THEN-PULL, the safe
 *       variant of the "PULL-then-unsub" hard ordering invariant: a frame source
 *       is ALWAYS live so the list never blanks (the cold-start T0 hydrate, run
 *       earlier in the same component via `useTokenListSlcColdStartHydrate`, has
 *       already painted the projection cells before this effect runs, and they
 *       hold until the first PULL/push supersedes them at a higher generation),
 *   (c) funnels both push + pull through the UNCHANGED apply contract
 *       (`applyStructureSnapshot` / `applyValuationFrame`), re-stamping
 *       `storeData` to THIS store so apply's identity guard passes,
 *   (d) version-guards every apply: drop a structure frame/pull whose
 *       structureVersion <= the last applied (== curGeneration semantics) and a
 *       valuation frame/pull whose valuationVersion <= the last applied. A PULL
 *       result that races an older/newer push is resolved by the same version
 *       guard (higher version wins, lower is dropped), and a PULL that resolves
 *       after a newer push has applied is dropped (its versions are <= applied).
 *
 * On a STRUCTURE apply (the projection it reads is now BG-fed) it persists the
 * slim cold-start bundle — EXACTLY ONE writer per storeName (design D4,
 * single-writer guard via the registry) so the cold-start double-authority
 * revival cannot occur. NO BG slim write.
 *
 * The hook holds no business logic — all derivation lives in the BG VM +
 * `buildFrames`; this is a thin jotai/React receive shell.
 */
import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/pure';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/slcPure/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IAccountToken,
  ICustomTokenItem,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import {
  listStructureAtom,
  riskyListFrameAtom,
  useTokenListContextData,
} from '../atoms';

import {
  applyRiskyFrame,
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from './apply';
import {
  cancelPendingSlimColdCache,
  schedulePersistSlimColdCache,
} from './coldStart';
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
import {
  deregisterMountedStore,
  isPrimaryColdStartWriter,
  registerMountedStore,
} from './registry';

import type { IApplyDeps } from './apply';
import type { IJotaiContextStore } from '../../../utils/createJotaiContext';

/**
 * hideZero "keep default zero-balance" inputs (spec §8#2). Kept on the signature
 * for call-site compatibility; in Phase-2 the BG VM owns the `nonZeroIds`
 * authority (it receives these via `ingestRound`), so the receive shell does not
 * read them — they are passed to the seam, not here.
 */
export interface ITokenListSlcProducerNonZeroInputs {
  keepDefault?: boolean;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  customTokens?: ICustomTokenItem[];
}

/**
 * Receive shell. Call once from the home `TokenListBlock`, passing the current
 * `${accountId}__${networkId}` owner key and the settings currency id. The
 * `nonZeroInputs` arg is retained for call-site compatibility (the seam feeds
 * them to the BG VM); it is unused by this shell.
 *
 * `storeName` is the registry/cold-start key. When omitted it is resolved from
 * the store's cold-start scope stamp (`resolveStoreData`), which is present for
 * the home/urlAccount NAMED stores; an anonymous mount must pass it explicitly.
 */
export function useTokenListSlcProducer(
  ownerKey: string,
  currencyId: string,
  _nonZeroInputs?: ITokenListSlcProducerNonZeroInputs,
  storeName?: string,
): void {
  const { store } = useTokenListContextData();

  // Stable deps bag bound to this store. `meta/cell/subcell/aggCell` resolve the
  // SAME per-store projection the leaves read (via the WeakMap), so the shell
  // and `useTokenFiat` share one cell registry. `resolveCurrentStore` is bound
  // to RETURN THIS STORE for THIS store's storeData so apply's identity guard
  // passes even for an anonymous mount (not in jotaiContextStore.storeCache);
  // a frame stamped for a different storeData still resolves through the real
  // registry and is correctly dropped.
  const deps = useMemo<IApplyDeps | undefined>(() => {
    if (!store) {
      return undefined;
    }
    return buildApplyDeps({
      store,
      listStructureAtom: listStructureAtom(),
      riskyListFrameAtom: riskyListFrameAtom(),
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

  // Current settings currency id, read inside the handlers via a ref so a
  // currency switch doesn't rebuild the subscription. The slim cold-start bundle
  // stores this currency for the T0 gate (spec §7, §3#3).
  const currencyIdRef = useRef<string>(currencyId);
  currencyIdRef.current = currencyId;

  // Last-applied monotonic versions for the version guard. Reset to -1 on owner
  // change so the new owner's first frame (which may start at a low generation)
  // is not dropped.
  const lastStructureVersionRef = useRef<number>(-1);
  const lastValuationVersionRef = useRef<number>(-1);
  // Risky frame version guard (design §R0). INDEPENDENT of structure/valuation;
  // co-located here + reset(-1) in the same place so an owner switch resets all
  // three together (red-team R-#2: a separate ref/effect would race owner
  // teardown vs an in-flight risky PULL and cross-apply owner-A risky onto
  // owner-B).
  const lastRiskyVersionRef = useRef<number>(-1);

  useEffect(() => {
    if (!store || !deps || !ownerKey) {
      return undefined;
    }
    const s: IJotaiContextStore = store;

    // S1. ensure projection + resolve this store's storeData/name + register.
    ensureStoreProjection(s);
    const storeData: IJotaiContextStoreData | undefined =
      resolveStoreData(s) ??
      (storeName ? ({ storeName } as IJotaiContextStoreData) : undefined);
    const resolvedStoreName = storeName ?? storeData?.storeName;
    if (!storeData || !resolvedStoreName) {
      // No identity for this store (bare node mount) — nothing to drive.
      return undefined;
    }
    registerMountedStore(resolvedStoreName, s);

    // Reset the version guard for this (store, owner) pass.
    lastStructureVersionRef.current = -1;
    lastValuationVersionRef.current = -1;
    lastRiskyVersionRef.current = -1;

    // S2. version-guarded apply helpers (closure over deps/store/refs).
    const applyStructure = (
      structureVersion: number,
      structure: IStructureSnapshot | undefined,
    ): void => {
      if (!structure) {
        return;
      }
      // Drop stale structure frames/pulls (== curGeneration semantics).
      if (structureVersion <= lastStructureVersionRef.current) {
        return;
      }
      const projection = ensureStoreProjection(s);
      // Re-stamp storeData to THIS store so apply's identity guard passes.
      applyStructureSnapshot(s, projection, { ...structure, storeData }, deps);
      lastStructureVersionRef.current = structureVersion;

      // D4: persist the slim cold-start bundle, EXACTLY ONE writer per storeName
      // (primary-registered store only, avoiding the double-authority revival).
      // DEBOUNCED, not synchronous: applyStructureSnapshot registers meta cells
      // but the FIAT cells are created/filled by leaf render + applyValuationFrame
      // which run AFTER this. A synchronous persist here snapshots empty cells
      // -> compactFiat:{} (the cold-start "empty list" bug). The debounce lets
      // the accompanying valuation + leaves populate the cells first.
      if (isPrimaryColdStartWriter(resolvedStoreName, s)) {
        schedulePersistSlimColdCache({
          store: s,
          projection,
          getCurrency: () => currencyIdRef.current,
        });
      }
    };

    const applyValuation = (
      valuationVersion: number,
      valuation: IValuationFrame | undefined,
    ): void => {
      if (!valuation) {
        return;
      }
      if (valuationVersion <= lastValuationVersionRef.current) {
        return;
      }
      const projection = ensureStoreProjection(s);
      applyValuationFrame(
        s,
        projection,
        { ...valuation, storeData },
        deps,
        (fn) => fn(),
      );
      lastValuationVersionRef.current = valuationVersion;

      // Re-persist on valuation too: this is the apply that fills the fiat cells,
      // so a debounced persist scheduled here captures a NON-EMPTY compactFiat
      // (the structure-only persist froze it empty). Debounced + single-writer,
      // so a round's structure+valuation coalesce into one complete write.
      if (isPrimaryColdStartWriter(resolvedStoreName, s)) {
        schedulePersistSlimColdCache({
          store: s,
          projection,
          getCurrency: () => currencyIdRef.current,
        });
      }
    };

    // Risky apply (design §R0). Version-guard against the risky-only monotonic
    // version (independent of structure/valuation), identity-checked + landed in
    // `riskyListFrameAtom` via the SAME apply contract.
    const applyRisky = (
      riskyVersion: number,
      riskyTokens: IAccountToken[],
      riskyMap: Record<string, ITokenFiat>,
    ): void => {
      if (riskyVersion < 0) {
        return;
      }
      if (riskyVersion <= lastRiskyVersionRef.current) {
        return;
      }
      applyRiskyFrame(s, { riskyTokens, riskyMap, storeData, ownerKey }, deps);
      lastRiskyVersionRef.current = riskyVersion;
    };

    // S2b. frame handlers — ignore frames for a different owner; the BG VM may
    // have multiple owners and broadcasts to all shells.
    const onStructure = (payload: {
      ownerKey: string;
      structureVersion: number;
      structure: IStructureSnapshot;
    }): void => {
      if (payload.ownerKey !== ownerKey) {
        return;
      }
      applyStructure(payload.structureVersion, payload.structure);
    };
    const onValuation = (payload: {
      ownerKey: string;
      valuationVersion: number;
      valuation: IValuationFrame;
    }): void => {
      if (payload.ownerKey !== ownerKey) {
        return;
      }
      applyValuation(payload.valuationVersion, payload.valuation);
    };
    const onRisky = (payload: {
      ownerKey: string;
      riskyVersion: number;
      riskyTokens: IAccountToken[];
      riskyMap: Record<string, ITokenFiat>;
    }): void => {
      if (payload.ownerKey !== ownerKey) {
        return;
      }
      applyRisky(payload.riskyVersion, payload.riskyTokens, payload.riskyMap);
    };

    // S3. SUBSCRIBE FIRST. From this instant any push lands in the handlers (or
    // is version-dropped). This guarantees no push emitted during the S4 PULL is
    // lost — the H4 s.sub lines are DELETED, not toggled.
    appEventBus.on(EAppEventBusNames.TokenListSlcStructureFrame, onStructure);
    appEventBus.on(EAppEventBusNames.TokenListSlcValuationFrame, onValuation);
    // Risky frame (design §R0 #6): the 3rd subscribe-then-pull, INSIDE this same
    // effect body + sharing the same `cancelled` flag (below) so the owner-switch
    // teardown discards an in-flight risky PULL alongside the other two.
    appEventBus.on(EAppEventBusNames.TokenListSlcRiskyFrame, onRisky);

    // S4. PULL the authoritative full frames and apply through the SAME
    // version-guarded path. A push racing this in-flight pull is not lost
    // (subscription is already live); whichever carries the higher version wins.
    let cancelled = false;
    void backgroundApiProxy.serviceTokenViewModel
      .getTokenListFrames({ ownerKey })
      .then((pulled) => {
        if (cancelled || pulled.ownerKey !== ownerKey) {
          return;
        }
        // structure first so cells exist before valuation self-heals them.
        applyStructure(pulled.structureVersion, pulled.structure);
        applyValuation(pulled.valuationVersion, pulled.valuation);
        // The frames PULL also carries the risky snapshot (the BG VM keeps it on
        // the same owner VM), so apply it here too — guarded by the SAME
        // `cancelled` flag + owner check above.
        applyRisky(pulled.riskyVersion, pulled.riskyTokens, pulled.riskyMap);
      })
      .catch(() => {
        // PULL failure is non-fatal: pushes keep the list live; the next
        // owner-change / foreground re-sync re-pulls.
      });

    return () => {
      cancelled = true;
      appEventBus.off(
        EAppEventBusNames.TokenListSlcStructureFrame,
        onStructure,
      );
      appEventBus.off(
        EAppEventBusNames.TokenListSlcValuationFrame,
        onValuation,
      );
      appEventBus.off(EAppEventBusNames.TokenListSlcRiskyFrame, onRisky);
      // Drop any pending debounced persist so a late write cannot land on a
      // torn-down/owner-switched projection.
      cancelPendingSlimColdCache(s);
      deregisterMountedStore(resolvedStoreName, s);
    };
  }, [store, deps, ownerKey, storeName]);
}
