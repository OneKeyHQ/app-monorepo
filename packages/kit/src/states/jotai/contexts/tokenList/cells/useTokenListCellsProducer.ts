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
 *
 * Apply funnels through the UNCHANGED apply contract (`applyStructureSnapshot` /
 * `applyValuationFrame` / `applyRiskyFrame`); the cold-start T0 hydrate
 * (`useTokenListCellsColdStartHydrate`, run earlier in the same component) has
 * already painted the projection cells before this effect runs and they hold
 * until the first PULL/push supersedes them at a higher generation.
 */
import { useEffect, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type {
  IStructureSnapshot,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

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

type ITokenFrameKind = 'structure' | 'valuation' | 'risky';

interface IStructurePush {
  ownerKey: string;
  structureVersion: number;
  structure: IStructureSnapshot;
}
interface IValuationPush {
  ownerKey: string;
  valuationVersion: number;
  valuation: IValuationFrame;
}
interface IRiskyPush {
  ownerKey: string;
  riskyVersion: number;
  riskyTokens: IAccountToken[];
  riskyMap: Record<string, ITokenFiat>;
}
interface IFramesPull {
  ownerKey: string;
  structureVersion: number;
  valuationVersion: number;
  structure: IStructureSnapshot | undefined;
  valuation: IValuationFrame | undefined;
  riskyVersion: number;
  riskyTokens: IAccountToken[];
  riskyMap: Record<string, ITokenFiat>;
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

  useEffect(() => {
    if (!enabled || !store || !deps || !identity) {
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
          const { structure } = p as IStructurePush;
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
          const { valuation } = p as IValuationPush;
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
          const { riskyTokens, riskyMap } = p as IRiskyPush;
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
