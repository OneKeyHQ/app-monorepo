/**
 * The UI snapshots that a feature declares outright, rather than deriving
 * from an SWR key.
 *
 * They used to be four keys inside one shared cold-start store, which meant a
 * feature's cache could be evicted by an unrelated one and a startup read had
 * to open a file every other feature also wrote. Each now owns a namespace,
 * with its own retention and its own file (native) or key space (web).
 */
import { COLD_START_SNAPSHOT_HARD_MAX_CHARS } from '../utils/coldStartCacheSnapshotUtils';

import { createNamespacedSnapshotCache } from './SnapshotCache';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The serialized context-atom snapshot: one record, read on the startup path
 * before the first frame and rewritten whole by the flusher that owns it.
 */
const contextAtomSnapshotCache = createNamespacedSnapshotCache<string>({
  namespace: 'ctx-atom-snapshot',
  maxAgeMs: THIRTY_DAYS_MS,
  maxEntries: 1,
  maxRecordBytes: COLD_START_SNAPSHOT_HARD_MAX_CHARS,
});

const CONTEXT_ATOM_SNAPSHOT_KEY = 'v1';

export function readContextAtomSnapshotRaw(): string | undefined {
  return contextAtomSnapshotCache.get(CONTEXT_ATOM_SNAPSHOT_KEY)?.data;
}

export function writeContextAtomSnapshotRaw(serialized: string): void {
  contextAtomSnapshotCache.set(CONTEXT_ATOM_SNAPSHOT_KEY, serialized);
}

/** Which account each selector scene last had open. */
export const accountSelectorSnapshotCache = createNamespacedSnapshotCache<
  Record<string, unknown>
>({
  namespace: 'account-selector',
  maxAgeMs: THIRTY_DAYS_MS,
  maxEntries: 1,
});

export const ACCOUNT_SELECTOR_RECENT_SELECTION_KEY = 'recent-selection';

/** One-time maintenance markers for the token list's cold-start slot. */
export const tokenListMaintenanceCache = createNamespacedSnapshotCache<number>({
  namespace: 'tokenlist-maintenance',
  maxAgeMs: THIRTY_DAYS_MS,
  maxEntries: 4,
});

export const TOKEN_LIST_CLEANUP_VERSION_KEY = 'cleanup-version';

/**
 * Measured height of each native home header layout (OK-63873), keyed by the
 * layout variant. The collapsible tab container needs the height of the
 * incoming layout before it is laid out to keep the tab content aligned on an
 * account switch; remembering it across launches means the first switch after
 * a cold start is aligned too.
 */
export const homeHeaderLayoutCache = createNamespacedSnapshotCache<number>({
  namespace: 'home-header-layout',
  maxAgeMs: THIRTY_DAYS_MS,
  maxEntries: 8,
});

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Per-owner slim token-list bundles (OK-63873). The context-atom snapshot
 * above holds ONE bundle per store (the owner on screen at the last flush),
 * which only covers a cold start into that same owner. This namespace keeps
 * the most recent owners so an account/network switch after a cold start
 * paints the target owner's rows synchronously instead of a skeleton. Reads
 * are by exact key (one small record), never on the startup path.
 *
 * The count bound is by write time, so a switch back to a remembered owner
 * calls `touch` to keep it resident; without that a wallet with more accounts
 * than the cap evicted every owner on each rotation and switched into a
 * skeleton. Bundles are ~5-25 KB each.
 */
export const TOKEN_LIST_OWNER_SLIM_CACHE_MAX_ENTRIES = 32;

export const tokenListOwnerSlimCache = createNamespacedSnapshotCache<
  Record<string, unknown>
>({
  namespace: 'tokenlist-owner-slim',
  maxAgeMs: SEVEN_DAYS_MS,
  maxEntries: TOKEN_LIST_OWNER_SLIM_CACHE_MAX_ENTRIES,
});

/**
 * Per-owner token-worth snapshot (OK-63873). `accountWorthAtom` is a singleton
 * replaced on every owner switch, so the "Tokens · $x" subtitle kept showing
 * the previous owner's value until the new owner's local cache was read. This
 * namespace keeps the last worth per owner so a switch can restore it in the
 * same frame as the token rows.
 */
export const tokenListOwnerWorthCache = createNamespacedSnapshotCache<
  Record<string, unknown>
>({
  namespace: 'tokenlist-owner-worth',
  maxAgeMs: SEVEN_DAYS_MS,
  maxEntries: TOKEN_LIST_OWNER_SLIM_CACHE_MAX_ENTRIES,
});

/**
 * Cache keys may only carry `[A-Za-z0-9._:/-]`; an owner key embeds derive
 * paths (`hd-1--m/86'/0'/0'__btc--0`), so escape every other character as
 * `-xHH-` (reversible, collision-free) and scope by store name.
 */
export function buildTokenListOwnerSlimCacheKey({
  storeName,
  ownerKey,
}: {
  storeName: string;
  ownerKey: string;
}): string {
  const escape = (value: string) =>
    value.replace(
      /[^A-Za-z0-9._:/]/g,
      (ch) => `-x${ch.charCodeAt(0).toString(16)}-`,
    );
  return `${escape(storeName)}/${escape(ownerKey)}`;
}
