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
