/**
 * TokenList cells — Phase-2 per-storeName MOUNTED-STORE REGISTRY (design §5 PR-2).
 *
 * WHY (load-bearing fact): `withTokenListProvider` with no `store` prop does
 * `createStore()` (createJotaiContext.tsx) → an ANONYMOUS store NOT registered
 * in `jotaiContextStore.storeCache` and with NO cold-start scope stamp. So a BG
 * frame for a given `storeName` cannot be fanned out to a second live mount via
 * `resolveCurrentStore` (= getStore) — that only knows the home/urlAccount
 * NAMED stores. The receive shell therefore self-registers EVERY mounted store
 * under its `storeName`, keyed by name (NOT owner): all live mounts that mirror
 * one BG stream share the storeName but may be distinct store instances; the
 * owner is matched per-store by apply's owner guard, not by this registry.
 *
 * In the broadcast model each mounted shell subscribes independently and
 * applies only to its own store (apply's identity/owner guards keep it sound),
 * so appEventBus broadcast IS the natural fan-out. This registry is retained as
 * (1) the SINGLE-SLIM-WRITER backstop — only the first-registered store for a
 * storeName persists the cold-start slim bundle, avoiding double writers — and
 * (2) a double-mount enumeration backstop.
 *
 * kit-only; imports nothing from kit-bg except the store TYPE.
 */
import type { IJotaiContextStore } from '../../../utils/createJotaiContext';

const mountedStoresByName = new Map<string, Set<IJotaiContextStore>>();

/**
 * Register a mounted store under its `storeName`. Idempotent (Set semantics).
 */
export function registerMountedStore(
  storeName: string,
  store: IJotaiContextStore,
): void {
  let set = mountedStoresByName.get(storeName);
  if (!set) {
    set = new Set();
    mountedStoresByName.set(storeName, set);
  }
  set.add(store);
}

/**
 * Deregister a mounted store. Drops the Map entry when the Set empties so the
 * registry never retains a stale storeName with no live stores.
 */
export function deregisterMountedStore(
  storeName: string,
  store: IJotaiContextStore,
): void {
  const set = mountedStoresByName.get(storeName);
  if (!set) {
    return;
  }
  set.delete(store);
  if (set.size === 0) {
    mountedStoresByName.delete(storeName);
  }
}

/** Snapshot array of the live stores for a storeName (empty if none). */
export function getMountedStores(storeName: string): IJotaiContextStore[] {
  const set = mountedStoresByName.get(storeName);
  return set ? Array.from(set) : [];
}

/**
 * SINGLE-SLIM-WRITER guard (design §5 PR-2 step 3, D4): true only for the FIRST
 * store registered under a storeName (the home named store registers first).
 * The cold-start slim bundle is written by exactly one store per storeName so
 * the double-authority revival (memory reference_coldstart_cache_double_authority)
 * cannot occur via redundant writers. A second isolated mount of the same name
 * (e.g. an AssetList double-page) does NOT also persist.
 */
export function isPrimaryColdStartWriter(
  storeName: string,
  store: IJotaiContextStore,
): boolean {
  const set = mountedStoresByName.get(storeName);
  if (!set || set.size === 0) {
    return false;
  }
  // Insertion-ordered Set: the first inserted store is the primary writer.
  const first = set.values().next().value;
  return first === store;
}
