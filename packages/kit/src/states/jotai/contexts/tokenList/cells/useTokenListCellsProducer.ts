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
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { loadHomeTokenListCache } from '@onekeyhq/kit/src/views/Home/components/TokenListBlock/buildHomeTokenListCacheIngestRound';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IJotaiContextStoreData } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { buildFrames } from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/buildFrames';
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
import { FrameSubscriberGate } from '@onekeyhq/shared/src/frameChannel';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  accountWorthAtom,
  overviewTokenCacheStateAtom,
} from '../../accountOverview';
import {
  activeAccountsAtom,
  useAccountSelectorContextData,
} from '../../accountSelector';
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
  createTokenListOwnerCache,
  registerHomeTokenListPreparer,
} from './ownerCache';
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
import { getHomeTokenListOwnerKey } from './useHomeTokenListOwnerKey';

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
): (currentOwner: string) => Promise<boolean> {
  const { store } = useTokenListContextData();
  const { store: accountSelectorStore } = useAccountSelectorContextData();

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

  // Explicit post-ingest pulls and subscribed pushes share one version gate.
  // A delayed pull must not roll back a newer valuation already on screen.
  const projectionGate = useMemo(
    () => ({
      ownerKey,
      store,
      gate: new FrameSubscriberGate<ITokenFrameKind>({
        structure: {},
        valuation: {},
        risky: { floorVersion: 0 },
      }),
    }),
    [ownerKey, store],
  );
  const projectionGateRef = useRef(projectionGate);
  projectionGateRef.current = projectionGate;

  const refreshProjection = useCallback(
    async (currentOwner: string) => {
      if (!store || !deps || !identity || !accountSelectorStore) return false;
      const frames =
        await backgroundApiProxy.serviceTokenViewModel.getTokenListFrames({
          ownerKey: currentOwner,
        });
      if (
        getHomeTokenListOwnerKey(
          accountSelectorStore.get(activeAccountsAtom())[0],
        ) !== currentOwner ||
        !frames.structure ||
        !frames.valuation ||
        projectionGateRef.current !== projectionGate
      )
        return false;
      const projection = ensureStoreProjection(store);
      if (projectionGate.gate.accept('structure', frames.structureVersion))
        applyStructureSnapshot(
          store,
          projection,
          { ...frames.structure, storeData: identity.storeData },
          deps,
        );
      if (projectionGate.gate.accept('valuation', frames.valuationVersion))
        applyValuationFrame(
          store,
          projection,
          { ...frames.valuation, storeData: identity.storeData },
          deps,
          (fn) => fn(),
        );
      if (projectionGate.gate.accept('risky', frames.riskyVersion))
        applyRiskyFrame(
          store,
          {
            ownerKey: currentOwner,
            riskyTokens: frames.riskyTokens,
            riskyMap: frames.riskyMap,
            storeData: identity.storeData,
          },
          deps,
        );
      return true;
    },
    [store, deps, identity, accountSelectorStore, projectionGate],
  );

  useLayoutEffect(() => {
    if (!store || !deps || !identity || !accountSelectorStore) return;
    const restoreOwner = createTokenListOwnerCache(
      store,
      deps,
      identity.storeData,
    );
    const unregister =
      identity.resolvedStoreName === EJotaiContextStoreNames.homeTokenList
        ? registerHomeTokenListPreparer(async (target, signal) => {
            const targetOwner = getHomeTokenListOwnerKey(target);
            const currency = currencyIdRef.current;
            if (
              !targetOwner ||
              targetOwner === ensureStoreProjection(store).curOwnerKey
            )
              return undefined;
            if (restoreOwner.has(targetOwner, currency)) {
              return () => {
                if (currencyIdRef.current === currency) {
                  restoreOwner(targetOwner, currency);
                }
              };
            }
            const pulled =
              await backgroundApiProxy.serviceTokenViewModel.getTokenListFrames(
                { ownerKey: targetOwner },
              );
            if (signal.aborted) return undefined;
            let structure = pulled.structure;
            let valuation = pulled.valuation;
            let risky = {
              ownerKey: targetOwner,
              riskyTokens: pulled.riskyTokens,
              riskyMap: pulled.riskyMap,
            };
            let local: Awaited<ReturnType<typeof loadHomeTokenListCache>>;
            if (!structure || !valuation) {
              local = await loadHomeTokenListCache(target, targetOwner, signal);
              if (signal.aborted || !local) return undefined;
              const [defaults, customTokens] = await Promise.all([
                backgroundApiProxy.serviceToken.getHomeDefaultTokenMap(),
                backgroundApiProxy.serviceCustomToken.getCustomTokens({
                  accountId: target.account?.id ?? '',
                  networkId: target.network?.id ?? '',
                }),
              ]);
              if (signal.aborted) return undefined;
              const frames = buildFrames(
                {
                  ...local.ingest,
                  keepDefault: true,
                  homeDefaultTokenMap: defaults,
                  customTokens,
                },
                {
                  structure: {
                    ...store.get(listStructureAtom()),
                    ownerKey: '',
                    generation: -1,
                  },
                  smallBalanceFiatValue: '',
                  metaByKey: {},
                },
              );
              structure = frames.structure;
              valuation = frames.valuation;
              risky = {
                ownerKey: targetOwner,
                riskyTokens: local.ingest.riskyTokens ?? [],
                riskyMap: local.ingest.riskyMap ?? {},
              };
            }
            if (!structure || !valuation) return undefined;
            const snapshot = {
              structure: { ...structure, storeData: identity.storeData },
              valuation: { ...valuation, storeData: identity.storeData },
              risky,
            };
            return () => {
              if (signal.aborted || currencyIdRef.current !== currency) return;
              restoreOwner.seed(targetOwner, currency, snapshot);
              restoreOwner(targetOwner, currency);
              if (local && target.account && target.network) {
                const overview = resolveCurrentStore({
                  storeName: EJotaiContextStoreNames.homeAccountOverview,
                });
                overview?.set(accountWorthAtom(), {
                  accountId: target.account.id,
                  worth: local.worth,
                  initialized: true,
                  updateAll: !!target.network.isAllNetworks && local.complete,
                  createAtNetworkWorth: '0',
                  currency: local.currency,
                });
                overview?.set(overviewTokenCacheStateAtom(), {
                  ownerKey: `${target.account.id}__${target.network.id}`,
                  hasCache: true,
                  isComplete: local.complete,
                });
              }
            };
          })
        : undefined;
    // Retain the synchronous fast path for selections outside the Home action.
    const unsubscribe = accountSelectorStore.sub(activeAccountsAtom(), () => {
      restoreOwner(
        getHomeTokenListOwnerKey(
          accountSelectorStore.get(activeAccountsAtom())[0],
        ),
        currencyIdRef.current,
      );
    });
    return () => {
      unregister?.();
      unsubscribe();
    };
  }, [accountSelectorStore, store, deps, identity]);

  const isCurrentOwner = () =>
    getHomeTokenListOwnerKey(
      accountSelectorStore?.get(activeAccountsAtom())[0],
    ) === ownerKey;

  const enabled = !!(store && deps && ownerKey && identity);

  useEffect(() => {
    if (
      !enabled ||
      !store ||
      !deps ||
      !identity ||
      store.get(riskyListFrameAtom()).ownerKey === ownerKey
    ) {
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
          const { structure, structureVersion } = p as IStructurePush;
          if (!structure || !store || !deps || !identity || !isCurrentOwner()) {
            return;
          }
          if (!projectionGate.gate.accept('structure', structureVersion))
            return;
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
          const { valuation, valuationVersion } = p as IValuationPush;
          if (!valuation || !store || !deps || !identity || !isCurrentOwner()) {
            return;
          }
          if (!projectionGate.gate.accept('valuation', valuationVersion))
            return;
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
          const { riskyTokens, riskyMap, riskyVersion } = p as IRiskyPush;
          if (!store || !deps || !identity || !isCurrentOwner()) {
            return;
          }
          if (!projectionGate.gate.accept('risky', riskyVersion)) return;
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
    extraDeps: [store, deps, storeName, accountSelectorStore, projectionGate],
  });
  return refreshProjection;
}
