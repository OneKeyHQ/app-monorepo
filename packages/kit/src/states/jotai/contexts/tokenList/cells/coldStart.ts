/**
 * TokenList cells — COLD START runtime wiring (spec §7).
 *
 * Closes the two §7 gaps that the pure functions (shared
 * tokenListSlimColdCacheUtils) and the apply contract left open:
 *
 *   1. WRITE (落盘): `readCellsColdStartProjection` walks the live projection
 *      cells/metas/aggSubCells + `listStructureAtom` into the slim-bundle build
 *      params; `persistSlimColdCache` builds the slim bundle (shared
 *      `buildSlimSnapshot`) and writes it to the cells-owned scoped key inside the
 *      shared cold-start snapshot blob (kit-bg `writeColdStartSnapshotKey`),
 *      never via `coldStartValuesMap` (so it can't be revived/clobbered by the
 *      generic flusher).
 *
 *   2. T0 READ + FAN-OUT (水合): `hydrateCellsFromColdStart` reads the slim bundle
 *      (native: the already-parsed `__ONEKEY_CTX_ATOM_SNAPSHOT__`; web/desktop:
 *      the in-memory cold-start map via the kit-bg sync reader), gates it with
 *      shared `shouldUseSlim(currency)`, then FANS OUT through the SAME apply
 *      contract — one `applyStructureSnapshot` + one `applyValuationFrame` — so
 *      a cold start paints rows + price + name/icon at T0 with no new paint
 *      path. A later real structure frame (higher generation) cleanly
 *      supersedes the hydrated one.
 *
 *   3. CLEANUP: `purgeOldColdStartIfNeeded` runs the version-flag one-time purge
 *      of the OLD `::ctx:renderedTokenListCacheAtom` disk fields + the defensive
 *      double-authority runtime-map kill — strictly AFTER the T0 read.
 *
 * This module is the ONLY allowed write/read wiring; the apply/projection/pure
 * leaves are untouched (it consumes them).
 */
import { useLayoutEffect, useMemo, useRef } from 'react';

import {
  fiatEqual,
  isAgg,
  metaEqual,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/pure';
import type {
  IAggKey,
  INetworkId,
  IStructureSnapshot,
  ITokenKey,
  IValuationFrame,
} from '@onekeyhq/kit-bg/src/states/jotai/contexts/tokenList/cellsPure/types';
import {
  purgeOldColdStartRuntimeKeys,
  readColdStartSnapshotKey,
  writeColdStartSnapshotKey,
} from '@onekeyhq/kit-bg/src/states/jotai/utils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { registerColdStartFlushTrigger } from '@onekeyhq/shared/src/storage/coldStartFlushTrigger';
import { coldStartCacheStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { parseColdStartSnapshotRaw } from '@onekeyhq/shared/src/utils/coldStartCacheSnapshotUtils';
import {
  OLD_RENDERED_TOKEN_LIST_CACHE_SCOPED_SUFFIX,
  TOKEN_COLD_START_CLEANUP_VERSION,
  TOKEN_LIST_SLIM_COLD_CACHE_KEY,
  buildSlimSnapshot,
  purgeOldColdStartFields,
  shouldUseSlim,
} from '@onekeyhq/shared/src/utils/tokenListSlimColdCacheUtils';
import type {
  IBuildSlimSnapshotParams,
  ICompactFiat,
  ITokenListSlimColdCache,
} from '@onekeyhq/shared/src/utils/tokenListSlimColdCacheUtils';
import type { IToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { listStructureAtom, useTokenListContextData } from '../atoms';

import {
  applyStructureSnapshot,
  applyValuationFrame,
  buildApplyDeps,
  shallowEqualArray,
} from './apply';
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

import type { IApplyDeps } from './apply';
import type { IStoreProjection } from './projection';
import type { IJotaiContextStore } from '../../../utils/createJotaiContext';

const COLD_START_SCOPED_KEY_SEPARATOR = '::';

/**
 * Persisted version-flag slot (spec §7) — stored under its own plain key in the
 * SAME cold-start storage instance (not the snapshot blob, not a context atom),
 * so the one-time purge runs once per cleanup version and re-runs after a
 * downgrade→upgrade (the persisted value would be < N again only if a newer
 * build bumps N).
 */
const TOKEN_COLD_START_CLEANUP_VERSION_STORAGE_KEY =
  EAppSyncStorageKeys.onekey_tokenlist_cold_start_cleanup_version;

type IGlobalColdStartSnapshot = typeof globalThis & {
  __ONEKEY_CTX_ATOM_SNAPSHOT__?: Record<string, unknown>;
};

/**
 * The cells-owned scoped key inside the shared snapshot blob:
 * `${store:<id>}::ctx:tokenListSlimColdCache`. Mirrors how the generic
 * cold-start writer scopes keys (kit-bg buildColdStartScopedKey).
 */
function buildSlimScopedKey(coldStartScopeKey: string): string {
  return `${coldStartScopeKey}${COLD_START_SCOPED_KEY_SEPARATOR}${TOKEN_LIST_SLIM_COLD_CACHE_KEY}`;
}

/**
 * The store stamps `__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__ = store:<id>` at
 * creation (jotaiContextStore.ts). Read it back to scope the slim slot the same
 * way the generic hydrator does. Returns undefined for a bare node store.
 */
function getColdStartScopeKey(store: IJotaiContextStore): string | undefined {
  return (
    store as IJotaiContextStore & {
      __ONEKEY_JOTAI_COLD_START_SCOPE_KEY__?: string;
    }
  ).__ONEKEY_JOTAI_COLD_START_SCOPE_KEY__;
}

// --- WRITE PATH (落盘) ------------------------------------------------------

/**
 * Walk the live projection + `listStructureAtom` into the slim-bundle build
 * params (spec §7 write). Reads each registered cell/meta/aggSubCell via
 * `store.get` so the bundle reflects exactly what is painted now. Currency is
 * the caller's responsibility (passed through `persistSlimColdCache`).
 */
export function readCellsColdStartProjection(
  store: IJotaiContextStore,
  projection: IStoreProjection,
): Omit<IBuildSlimSnapshotParams, 'currency'> {
  const structureValue = store.get(listStructureAtom());

  const fiatByKey: Record<ITokenKey, ITokenFiat | undefined> = {};
  for (const [key, cellAtom] of projection.cells) {
    fiatByKey[key] = store.get(cellAtom);
  }

  const metaByKey: Record<ITokenKey, IToken | undefined> = {};
  for (const [key, metaAtom] of projection.metas) {
    metaByKey[key] = store.get(metaAtom);
  }

  const aggFiatByKey: Record<
    IAggKey,
    Record<INetworkId, ITokenFiat | undefined>
  > = {};
  for (const [aggKey, byNet] of projection.aggSubCells) {
    const out: Record<INetworkId, ITokenFiat | undefined> = {};
    for (const [net, subAtom] of byNet) {
      out[net] = store.get(subAtom);
    }
    aggFiatByKey[aggKey] = out;
  }

  return {
    structure: {
      orderedIds: structureValue.orderedIds,
      smallBalanceIds: structureValue.smallBalanceIds,
      aggMembership: structureValue.aggMembership,
      ownerKey: structureValue.ownerKey,
      generation: structureValue.generation,
      // Persist the hideZero membership + strict funded set so a hideZero cold
      // start paints the kept set at T0 instead of being filtered to the empty
      // placeholder (the original "list empty for a long time" bug).
      nonZeroIds: structureValue.nonZeroIds,
      fundedIds: structureValue.fundedIds,
      smallBalanceFiatValue: structureValue.smallBalanceFiatValue,
      ownedAggregateTokenListMap: structureValue.ownedAggregateTokenListMap,
    },
    fiatByKey,
    aggFiatByKey,
    metaByKey,
  };
}

/**
 * Build the slim bundle from the live projection + currency and persist it to
 * the cells-owned scoped key (spec §7 落盘). Debounced RMW via kit-bg
 * `writeColdStartSnapshotKey`. No-op when the store carries no cold-start scope
 * (a bare node store / unmounted) or the currency is empty.
 */
export function persistSlimColdCache(params: {
  store: IJotaiContextStore;
  projection: IStoreProjection;
  currency: string;
}): void {
  const { store, projection, currency } = params;
  if (!currency) {
    return;
  }
  const scopeKey = getColdStartScopeKey(store);
  if (!scopeKey) {
    return;
  }
  const buildParams = readCellsColdStartProjection(store, projection);
  const slim = buildSlimSnapshot({ ...buildParams, currency });
  writeColdStartSnapshotKey({
    scopedKey: buildSlimScopedKey(scopeKey),
    value: slim,
  });
}

// --- DEBOUNCED PERSIST SCHEDULER -------------------------------------------

/**
 * Debounce window for the slim persist. The persist walks the live projection
 * cells; `applyStructureSnapshot` registers META cells but the FIAT cells are
 * created/filled by `applyValuationFrame` which runs AFTER the structure apply.
 * Persisting synchronously inside `applyStructure` therefore snapshots EMPTY
 * cells -> `compactFiat: {}` (rows with no prices, the cold-start "empty list"
 * bug). Scheduling a short-debounced persist from BOTH the structure and the
 * valuation apply lets the cells fill first and coalesces one round's two
 * frames into a single write that captures a COMPLETE bundle.
 */
export const PERSIST_DEBOUNCE_MS = 500;

interface IPendingSlimPersist {
  timer: ReturnType<typeof setTimeout>;
  run: () => void;
}

// Per-store pending persist. Keyed by the store OBJECT so a store reset/recreate
// (new object) starts a fresh slot; entries are removed on fire/cancel so this
// never retains a dead store.
const slimPersistPending = new Map<IJotaiContextStore, IPendingSlimPersist>();

let slimPersistFlushTriggerRegistered = false;

/**
 * On app background / tab hide, force out any pending debounced persist so a
 * quit inside the debounce window does not lose the slim bundle. Idempotent.
 */
function ensureSlimPersistFlushTrigger(): void {
  if (slimPersistFlushTriggerRegistered) {
    return;
  }
  slimPersistFlushTriggerRegistered = true;
  try {
    registerColdStartFlushTrigger(() => {
      for (const store of Array.from(slimPersistPending.keys())) {
        flushPendingSlimColdCache(store);
      }
    });
  } catch {
    slimPersistFlushTriggerRegistered = false;
  }
}

/**
 * Schedule a debounced slim persist for `store`. Re-scheduling within the
 * window resets the timer (coalescing), and the persist reads the LIVE
 * projection + currency at FIRE time — so by the time it runs the accompanying
 * valuation has populated the fiat cells. Callers gate this with the
 * single-slim-writer registry guard exactly as the synchronous persist did.
 */
export function schedulePersistSlimColdCache(params: {
  store: IJotaiContextStore;
  projection: IStoreProjection;
  getCurrency: () => string;
}): void {
  const { store, projection, getCurrency } = params;
  ensureSlimPersistFlushTrigger();
  const existing = slimPersistPending.get(store);
  if (existing) {
    clearTimeout(existing.timer);
  }
  const run = () => {
    slimPersistPending.delete(store);
    persistSlimColdCache({ store, projection, currency: getCurrency() });
  };
  const timer = setTimeout(run, PERSIST_DEBOUNCE_MS);
  slimPersistPending.set(store, { timer, run });
}

/** Run a pending persist for `store` immediately (background flush trigger). */
export function flushPendingSlimColdCache(store: IJotaiContextStore): void {
  const pending = slimPersistPending.get(store);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  pending.run();
}

/**
 * Drop a pending persist for `store` without running it (producer unmount /
 * owner switch) so a late persist cannot land on a torn-down/stale projection.
 */
export function cancelPendingSlimColdCache(store: IJotaiContextStore): void {
  const pending = slimPersistPending.get(store);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  slimPersistPending.delete(store);
}

// --- T0 READ + FAN-OUT HYDRATE (水合) --------------------------------------

/**
 * Read the slim bundle for a store. Native: from the already-parsed
 * `__ONEKEY_CTX_ATOM_SNAPSHOT__` (pre-read at boot). Web/desktop: from the
 * in-memory cold-start map via the kit-bg sync reader (the same physical blob).
 */
function readSlimColdCache(
  store: IJotaiContextStore,
): ITokenListSlimColdCache | undefined {
  const scopeKey = getColdStartScopeKey(store);
  if (!scopeKey) {
    return undefined;
  }
  const scopedKey = buildSlimScopedKey(scopeKey);

  const nativeSnapshot = (globalThis as IGlobalColdStartSnapshot)
    .__ONEKEY_CTX_ATOM_SNAPSHOT__;
  if (nativeSnapshot && scopedKey in nativeSnapshot) {
    return nativeSnapshot[scopedKey] as ITokenListSlimColdCache | undefined;
  }

  const value = readColdStartSnapshotKey({ scopedKey });
  return (value as ITokenListSlimColdCache | undefined) ?? undefined;
}

/** Widen a compact disk fiat back to a full `ITokenFiat` with safe defaults. */
function widenCompactFiat(compact: ICompactFiat, currency: string): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: compact.balanceParsed,
    fiatValue: compact.fiatValue,
    price: compact.price,
    price24h: compact.price24h,
    currency: compact.currency ?? currency,
  };
}

/**
 * Fan out a slim bundle through the SAME apply contract (spec §7). Builds an
 * `IStructureSnapshot` from the slim ids/membership/compactMeta + an
 * `IValuationFrame` from compactFiat/compactAggFiat (widened to ITokenFiat), and
 * applies them via `applyStructureSnapshot` / `applyValuationFrame`. This is the
 * single paint path; no new renderer. Exposed (and side-effect-free w.r.t.
 * storage) so the T0 hydrate path is node-jest testable directly with a real
 * jotai store (spec §11.5).
 *
 * The cold paint is PROVISIONAL: after applying, `projection.curGeneration` is
 * reset to -1 so the first real structure frame of THIS session supersedes it.
 * The persisted `bundle.gen` is a generation from a PREVIOUS session and is NOT
 * comparable to the live producer's counter — the BG `ServiceTokenViewModel`
 * restarts its per-owner generation at -1 each process, so its first frame is
 * gen 0. Leaving `curGeneration = bundle.gen` (which can be large) would make
 * apply's generation guard DROP that gen-0 frame and pin the list to the stale
 * cold snapshot for the whole session (same-account warm restart). Resetting to
 * -1 lets gen 0 win; apply's owner/identity guards still hold.
 */
export function fanOutSlimToApply(params: {
  store: IJotaiContextStore;
  projection: IStoreProjection;
  deps: IApplyDeps;
  bundle: ITokenListSlimColdCache;
  storeData: Parameters<IApplyDeps['resolveCurrentStore']>[0];
}): void {
  const { store, projection, deps, bundle, storeData } = params;

  ensureStoreProjection(store);

  // --- structure frame -----------------------------------------------------
  const metaPatch: Record<ITokenKey, IToken> = {};
  for (const key of Object.keys(bundle.compactMeta)) {
    metaPatch[key] = bundle.compactMeta[key];
  }

  const structure: IStructureSnapshot = {
    orderedIds: bundle.orderedIds,
    smallBalanceIds: bundle.smallBalanceIds,
    // nonZeroIds is the hideZero VIEW filter (spec §8#2). It IS persisted in the
    // slim bundle now (so a hideZero cold start paints the kept set at T0 rather
    // than being filtered to the empty placeholder); older bundles without it
    // fall back to `[]` and fill on the first real frame. The cold paint is
    // provisional (curGeneration reset to -1 below), so the first real frame
    // still supersedes it with the authoritative set.
    nonZeroIds: bundle.nonZeroIds ?? [],
    // fundedIds (STRICT balance>0) is likewise persisted now so `hasHoldingsNow`
    // is correct at T0; older bundles fall back to `[]`.
    fundedIds: bundle.fundedIds ?? [],
    metaPatch,
    aggMembership: bundle.aggMembership,
    // Restore the REAL persisted small-balance fiat scalar (PR-0 enabler) instead
    // of hardcoding '0'; older bundles without the field fall back to '0'.
    smallBalanceFiatValue: bundle.smallBalanceFiatValue ?? '0',
    // Restore the persisted owned aggregate sub-token list-map so cold aggregate
    // badges/sub-token lists paint at T0 (full-delete PR-7); older bundles
    // without the field fall back to `{}` and fill on the first real frame.
    ownedAggregateTokenListMap: bundle.ownedAggregateTokenListMap ?? {},
    storeData,
    ownerKey: bundle.ownerKey,
    generation: bundle.gen,
  };
  applyStructureSnapshot(store, projection, structure, deps);

  // --- valuation frame -----------------------------------------------------
  // applyValuationFrame is orphan-guarded: it writes ONLY cells that already
  // exist (`P.cells.has`). In the normal producer flow leaves create those
  // cells as they render; at T0 cold-start NO leaf has rendered yet, so we must
  // eagerly create each normal cell here (the same lazy builder a leaf would
  // use) so the slim values actually paint. Aggregate ids flow through the agg
  // channel and their sub-cells were ensured by applyStructureSnapshot.
  const changedFiatById: Record<ITokenKey, ITokenFiat> = {};
  for (const key of Object.keys(bundle.compactFiat)) {
    deps.cell(store, key);
    changedFiatById[key] = widenCompactFiat(
      bundle.compactFiat[key],
      bundle.currency,
    );
  }

  const changedAggFiat: Record<IAggKey, Record<INetworkId, ITokenFiat>> = {};
  for (const aggKey of Object.keys(bundle.compactAggFiat)) {
    const byNet = bundle.compactAggFiat[aggKey];
    const out: Record<INetworkId, ITokenFiat> = {};
    for (const net of Object.keys(byNet)) {
      out[net] = widenCompactFiat(byNet[net], bundle.currency);
    }
    changedAggFiat[aggKey] = out;
  }

  const valuation: IValuationFrame = {
    changedFiatById,
    changedAggFiat,
    storeData,
    ownerKey: bundle.ownerKey,
  };
  applyValuationFrame(store, projection, valuation, deps, (fn) => fn());

  // The cold paint is provisional (see the doc comment above). `bundle.gen` is
  // from a previous session and is not comparable to the fresh live counter;
  // reset so this session's first structure frame (BG VM starts at gen 0)
  // supersedes the hydrated paint instead of being dropped by apply's gen guard.
  projection.curGeneration = -1;
}

/**
 * T0 fan-out hydrate (spec §7). Reads the slim bundle for the store, gates on
 * currency via shared `shouldUseSlim` (a currency mismatch / absent bundle is a
 * MISS — no paint, skeleton until fetch, spec §3#3, §11.4), then fans it out
 * through `fanOutSlimToApply`. Returns true when it painted, false on a miss.
 */
export function hydrateCellsFromColdStart(params: {
  store: IJotaiContextStore;
  projection: IStoreProjection;
  deps: IApplyDeps;
  currentCurrency: string;
}): boolean {
  const { store, projection, deps, currentCurrency } = params;

  const slim = readSlimColdCache(store);
  // Merge gate (spec §11.4): currency mismatch / absent -> miss, do not paint.
  if (!shouldUseSlim(slim, currentCurrency)) {
    return false;
  }
  // shouldUseSlim returning true guarantees `slim` is defined.
  const bundle = slim as ITokenListSlimColdCache;

  const storeData = resolveStoreData(store);
  if (!storeData) {
    return false;
  }

  fanOutSlimToApply({ store, projection, deps, bundle, storeData });
  return true;
}

// --- VERSION-FLAG CLEANUP --------------------------------------------------

// TODO(cleanup, remove after one shipped release): TRANSITIONAL migration code.
// `purgeOldColdStartIfNeeded` + `scheduleColdStartCleanupOnce` exist only to
// one-time evict the OLD `::ctx:renderedTokenListCacheAtom` cold-start fields
// (disk + the in-memory double-authority map) left by builds prior to the slim
// bundle. Once every active install has launched a build carrying this purge,
// these two functions, the `TOKEN_COLD_START_CLEANUP_VERSION*` flag, the
// `purgeOldColdStartRuntimeKeys` import, and the HomePageReady hook can all be
// deleted — the slim key is never matched by the purge, so removing it is safe.

/**
 * One-time version-flag purge of the OLD persisted cold-start fields (spec §7).
 * MUST run AFTER the T0 read+fan-out (scheduled on HomePageReady) so it never
 * deletes data the hydrate still needs. It:
 *   - reads the snapshot blob, applies shared `purgeOldColdStartFields` (removes
 *     every `::ctx:renderedTokenListCacheAtom` field; the new slim key is NEVER
 *     matched), writes the purged blob back;
 *   - defensively kills the in-memory double-authority via kit-bg
 *     `purgeOldColdStartRuntimeKeys` (coldStartValuesMap + coldStartDirtyKeys);
 *   - bumps the persisted flag to N so it runs once per version.
 * No-op when the persisted flag is already >= N.
 */
export function purgeOldColdStartIfNeeded(): void {
  try {
    const persisted =
      coldStartCacheStorage.getNumber(
        TOKEN_COLD_START_CLEANUP_VERSION_STORAGE_KEY,
      ) ?? 0;
    if (persisted >= TOKEN_COLD_START_CLEANUP_VERSION) {
      return;
    }

    // Disk purge: strip OLD `::ctx:renderedTokenListCacheAtom` fields. The NEW
    // slim key does not match the suffix, so it survives untouched.
    const raw = coldStartCacheStorage.getString(
      EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
    );
    const snapshot = parseColdStartSnapshotRaw(raw);
    if (snapshot) {
      const purged = purgeOldColdStartFields(snapshot);
      coldStartCacheStorage.set(
        EAppSyncStorageKeys.onekey_jotai_context_atoms_snapshot,
        JSON.stringify(purged),
      );
    }

    // Defensive double-authority kill: the disk-only delete above would be
    // revived within ~2s by the generic flush rebuilding from the in-memory
    // map, so also delete from coldStartValuesMap + coldStartDirtyKeys (memory
    // reference_coldstart_cache_double_authority).
    purgeOldColdStartRuntimeKeys(OLD_RENDERED_TOKEN_LIST_CACHE_SCOPED_SUFFIX);

    coldStartCacheStorage.set(
      TOKEN_COLD_START_CLEANUP_VERSION_STORAGE_KEY,
      TOKEN_COLD_START_CLEANUP_VERSION,
    );
  } catch {
    /* best-effort — cleanup is non-critical and self-heals next launch */
  }
}

let cellsColdStartCleanupScheduled = false;

/**
 * Schedule the version-flag purge to run on HomePageReady (the same trigger the
 * generic snapshot self-cleanup uses), strictly AFTER the T0 read + fan-out, so
 * we never delete data the hydrate still needs and never touch the new slim
 * key. Idempotent across mounts.
 */
function scheduleColdStartCleanupOnce(): void {
  if (cellsColdStartCleanupScheduled) {
    return;
  }
  cellsColdStartCleanupScheduled = true;
  try {
    appEventBus.once(EAppEventBusNames.HomePageReady, () => {
      purgeOldColdStartIfNeeded();
    });
  } catch {
    cellsColdStartCleanupScheduled = false;
  }
}

// --- CALL-SITE HOOK --------------------------------------------------------

/**
 * Cold-start hydrate hook (spec §7 T0). Call once from the home `TokenListBlock`
 * (the producer's mount owner), BEFORE the async fetch runs. It:
 *   - builds the SAME apply deps bag the producer uses (bound to this store);
 *   - runs `hydrateCellsFromColdStart` exactly once per (store, ownerKey) via a
 *     ref-guard, eagerly in a `useLayoutEffect` so the cells are painted at T0
 *     (the producer's own mount-prime flush + the real fetch then keep them
 *     fresh; a higher-generation real frame supersedes the hydrated one);
 *   - schedules the one-time version-flag purge on HomePageReady.
 *
 * Thin shell: all logic lives in the pure / apply layers (spec §11.5).
 */
export function useTokenListCellsColdStartHydrate(
  ownerKey: string,
  currencyId: string,
): void {
  const { store } = useTokenListContextData();

  const deps = useMemo<IApplyDeps | undefined>(() => {
    if (!store) {
      return undefined;
    }
    return buildApplyDeps({
      store,
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

  const hydratedKeyRef = useRef<string | undefined>(undefined);

  useLayoutEffect(() => {
    scheduleColdStartCleanupOnce();
    if (!store || !deps || !ownerKey || !currencyId) {
      return;
    }
    const guardKey = ownerKey;
    if (hydratedKeyRef.current === guardKey) {
      return;
    }
    hydratedKeyRef.current = guardKey;
    const projection = ensureStoreProjection(store);
    hydrateCellsFromColdStart({
      store,
      projection,
      deps,
      currentCurrency: currencyId,
    });
  }, [store, deps, ownerKey, currencyId]);
}
