/**
 * TokenList cells — Phase-2 RECEIVE SHELL (design §5 PR-2, cutover; §4A.3).
 *
 * The BG `ServiceTokenViewModel` (the "TokenListFrameEngine") owns frame
 * production; this hook is the thin UI receive shell. It now delegates the
 * generic SUBSCRIBE-THEN-PULL + per-(kind,version) monotonic gate + owner filter
 * + applyOrder + cancelled teardown to the reusable `useFrameChannelSubscriber`,
 * and keeps ONLY the token-domain concerns the generic hook deliberately does
 * not absorb (red-team §4A.3):
 *   - storeData RE-STAMP to THIS store inside each `apply` (so apply's identity
 *     guard passes even for an anonymous mount; a frame stamped for a different
 *     store still resolves through the real registry and is dropped),
 *   - registry register/deregister in `onSetup`'s returned teardown,
 *   - the slim cold-start persist (single-writer) in `onAfterApply` — scheduled
 *     on BOTH structure and valuation applies so the debounced write captures a
 *     NON-EMPTY compactFiat (the structure-only persist would freeze it empty),
 *   - the anonymous-store / no-identity ABORT by passing `enabled: false`.
 *   - the OWNER-SWITCH REPLAY (OK-63873): every applied payload is remembered
 *     per owner on the main heap; when the owner changes, the remembered frames
 *     (or, after a cold start, the per-owner persisted slim bundle) are fanned
 *     out SYNCHRONOUSLY in a layout effect so the target owner's rows paint
 *     before the async PULL instead of a skeleton.
 *
 * Apply funnels through the UNCHANGED apply contract (`applyStructureSnapshot` /
 * `applyValuationFrame` / `applyRiskyFrame`); the cold-start T0 hydrate
 * (`useTokenListCellsColdStartHydrate`, run earlier in the same component) has
 * already painted the projection cells before this effect runs and they hold
 * until the first PULL/push supersedes them at a higher generation.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import {
  listStructureAtom,
  riskyListFrameAtom,
  useTokenListContextData,
} from '../atoms';
import { useFrameChannelSubscriber } from '../frameChannel/useFrameChannelSubscriber';

import {
  applyRiskyFrame,
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from './apply';
import {
  cancelPendingSlimColdCache,
  hydrateCellsFromOwnerSlimCache,
  schedulePersistSlimColdCache,
} from './coldStart';
import {
  clearOwnerReplayCache,
  getOwnerReplayFrames,
  rememberOwnerReplayFrame,
} from './ownerFrameReplayCache';
import { replayOwnerFrames } from './ownerReplay';
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
import type {
  IFramesPull,
  IRiskyPush,
  IStructurePush,
  IValuationPush,
} from './ownerFrameReplayCache';

type ITokenFrameKind = 'structure' | 'valuation' | 'risky';

let replayCacheInvalidationRegistered = false;

/**
 * Drop the main-heap replay frames when a wallet or account is removed so a
 * re-imported owner (same accountId) never replays the snapshot it had before
 * deletion. Whole-cache clear: the persisted per-owner slot still covers the
 * other owners, and the next switch to them re-fills the memory cache.
 */
function ensureReplayCacheInvalidationOnce(): void {
  if (replayCacheInvalidationRegistered) {
    return;
  }
  replayCacheInvalidationRegistered = true;
  const clear = () => clearOwnerReplayCache();
  appEventBus.on(EAppEventBusNames.WalletRemove, clear);
  appEventBus.on(EAppEventBusNames.AccountRemove, clear);
}

/**
 * Receive shell. Call once from the home `TokenListBlock`, passing the current
 * `${accountId}__${networkId}` owner key and the settings currency id. The BG VM
 * owns the `nonZeroIds` authority (fed via `ingestRound` from the seam), so this
 * shell takes no hideZero inputs.
 *
 * `storeName` is the registry/cold-start key. When omitted it is resolved from
 * the store's cold-start scope stamp (`resolveStoreData`), present for the
 * home/urlAccount NAMED stores; an anonymous mount must pass it explicitly.
 */
export function useTokenListCellsProducer(
  ownerKey: string,
  currencyId: string,
  storeName?: string,
): void {
  const { store } = useTokenListContextData();

  // Stable deps bag bound to this store. `meta/cell/subcell/aggCell` resolve the
  // SAME per-store projection the leaves read (via the WeakMap), so the shell
  // and `useTokenFiat` share one cell registry.
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
  // currency switch doesn't rebuild the subscription.
  const currencyIdRef = useRef<string>(currencyId);
  currencyIdRef.current = currencyId;

  // Resolve this store's identity (storeData + registry name). Undefined for a
  // bare/anonymous mount with no cold-start scope stamp and no explicit
  // storeName — which disables the subscription (the anonymous-store abort).
  const identity = useMemo(() => {
    if (!store) {
      return undefined;
    }
    ensureStoreProjection(store);
    const storeData: IJotaiContextStoreData | undefined =
      resolveStoreData(store) ??
      (storeName ? ({ storeName } as IJotaiContextStoreData) : undefined);
    const resolvedStoreName = storeName ?? storeData?.storeName;
    if (!storeData || !resolvedStoreName) {
      return undefined;
    }
    return { storeData, resolvedStoreName };
  }, [store, storeName]);

  const enabled = !!(store && deps && ownerKey && identity);

  // Owner-switch replay (OK-63873). Layout effect so it runs BEFORE paint and
  // BEFORE the subscription effect below: the projection is re-stamped for the
  // new owner from the remembered frames (same-session revisit) or, failing
  // that, from the per-owner persisted slim bundle (first visit after a cold
  // start). Either way `ownerMismatch` is already false on the first painted
  // frame; the PULL then reconciles (the replay is provisional: generation is
  // reset so any real frame supersedes it).
  const replayedRiskyOwnerRef = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    ensureReplayCacheInvalidationOnce();
    if (!enabled || !store || !deps || !identity) {
      return;
    }
    const projection = ensureStoreProjection(store);
    const currentCurrency = currencyIdRef.current;
    const replayed = replayOwnerFrames({
      store,
      projection,
      deps,
      frames: getOwnerReplayFrames({
        storeName: identity.resolvedStoreName,
        ownerKey,
      }),
      storeData: identity.storeData,
      ownerKey,
      currentCurrency,
    });
    replayedRiskyOwnerRef.current = replayed.risky ? ownerKey : undefined;
    if (replayed.structure) {
      return;
    }
    // Already stamped for this owner (the boot-blob cold-start hydrate or a
    // live frame landed first): nothing to paint, and no MMKV read on the
    // startup path.
    if (projection.curOwnerKey === ownerKey) {
      return;
    }
    hydrateCellsFromOwnerSlimCache({
      store,
      projection,
      deps,
      storeName: identity.resolvedStoreName,
      storeData: identity.storeData,
      ownerKey,
      currentCurrency,
    });
  }, [deps, enabled, identity, ownerKey, store]);

  useEffect(() => {
    if (!enabled || !store || !deps || !identity) {
      return;
    }
    // The owner reset blanks the risky list so a no-risky owner never shows
    // the previous owner's risky tokens. A risky frame replayed for THIS owner
    // in the layout effect above is already correct — blanking it here would
    // flash empty → list again once the PULL restores it.
    if (replayedRiskyOwnerRef.current === ownerKey) {
      return;
    }
    applyRiskyFrame(
      store,
      {
        riskyTokens: [],
        riskyMap: {},
        storeData: identity.storeData,
        ownerKey,
      },
      deps,
    );
  }, [deps, enabled, identity, ownerKey, store]);

  useFrameChannelSubscriber<ITokenFrameKind, IFramesPull>({
    ownerKey,
    enabled,
    applyOrder: ['structure', 'valuation', 'risky'],
    getPullOwnerKey: (pulled) => pulled.ownerKey,
    pull: () =>
      backgroundApiProxy.serviceTokenViewModel.getTokenListFrames({ ownerKey }),
    onSetup: () => {
      if (!store || !identity) {
        return undefined;
      }
      registerMountedStore(identity.resolvedStoreName, store);
      return () => {
        // Drop any pending debounced persist so a late write cannot land on a
        // torn-down/owner-switched projection, then deregister.
        cancelPendingSlimColdCache(store);
        deregisterMountedStore(identity.resolvedStoreName, store);
      };
    },
    onAfterApply: (kind) => {
      // Persist the slim cold-start bundle on structure AND valuation applies
      // (debounced + single-writer): structure registers meta cells but the fiat
      // cells are filled by valuation, so a valuation-time persist captures a
      // NON-EMPTY compactFiat. Not on risky.
      if (kind === 'risky' || !store || !identity) {
        return;
      }
      if (isPrimaryColdStartWriter(identity.resolvedStoreName, store)) {
        schedulePersistSlimColdCache({
          store,
          projection: ensureStoreProjection(store),
          getCurrency: () => currencyIdRef.current,
        });
      }
    },
    kinds: [
      {
        kind: 'structure',
        eventName: EAppEventBusNames.TokenListStructureFrame,
        getOwnerKey: (p) => (p as IStructurePush).ownerKey,
        getVersion: (p) => (p as IStructurePush).structureVersion,
        apply: (p) => {
          const push = p as IStructurePush;
          const { structure } = push;
          if (!structure || !store || !deps || !identity) {
            return;
          }
          // Re-stamp storeData to THIS store so apply's identity guard passes.
          applyStructureSnapshot(
            store,
            ensureStoreProjection(store),
            { ...structure, storeData: identity.storeData },
            deps,
          );
          rememberOwnerReplayFrame({
            storeName: identity.resolvedStoreName,
            ownerKey: push.ownerKey,
            kind: 'structure',
            payload: push,
            currencyId: currencyIdRef.current,
          });
        },
        fromPull: (pulled) =>
          pulled.structure
            ? ({
                ownerKey: pulled.ownerKey,
                structureVersion: pulled.structureVersion,
                structure: pulled.structure,
              } satisfies IStructurePush)
            : undefined,
      },
      {
        kind: 'valuation',
        eventName: EAppEventBusNames.TokenListValuationFrame,
        getOwnerKey: (p) => (p as IValuationPush).ownerKey,
        getVersion: (p) => (p as IValuationPush).valuationVersion,
        apply: (p) => {
          const push = p as IValuationPush;
          const { valuation } = push;
          if (!valuation || !store || !deps || !identity) {
            return;
          }
          applyValuationFrame(
            store,
            ensureStoreProjection(store),
            { ...valuation, storeData: identity.storeData },
            deps,
            (fn) => fn(),
          );
          rememberOwnerReplayFrame({
            storeName: identity.resolvedStoreName,
            ownerKey: push.ownerKey,
            kind: 'valuation',
            payload: push,
            currencyId: currencyIdRef.current,
          });
        },
        fromPull: (pulled) =>
          pulled.valuation
            ? ({
                ownerKey: pulled.ownerKey,
                valuationVersion: pulled.valuationVersion,
                valuation: pulled.valuation,
              } satisfies IValuationPush)
            : undefined,
      },
      {
        kind: 'risky',
        eventName: EAppEventBusNames.TokenListRiskyFrame,
        // Risky version is independent. Empty no-risky owners are cleared by the
        // owner reset above; floor 0 drops unknown-owner -1 PULLs.
        gate: { floorVersion: 0 },
        getOwnerKey: (p) => (p as IRiskyPush).ownerKey,
        getVersion: (p) => (p as IRiskyPush).riskyVersion,
        apply: (p) => {
          const push = p as IRiskyPush;
          const { riskyTokens, riskyMap } = push;
          if (!store || !deps || !identity) {
            return;
          }
          applyRiskyFrame(
            store,
            {
              riskyTokens,
              riskyMap,
              storeData: identity.storeData,
              ownerKey,
            },
            deps,
          );
          rememberOwnerReplayFrame({
            storeName: identity.resolvedStoreName,
            ownerKey: push.ownerKey,
            kind: 'risky',
            payload: push,
            currencyId: currencyIdRef.current,
          });
        },
        fromPull: (pulled) =>
          ({
            ownerKey: pulled.ownerKey,
            riskyVersion: pulled.riskyVersion,
            riskyTokens: pulled.riskyTokens,
            riskyMap: pulled.riskyMap,
          }) satisfies IRiskyPush,
      },
    ],
    extraDeps: [store, deps, storeName],
  });
}
