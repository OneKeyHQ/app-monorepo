import type { ISnapshotCacheNamespace } from './snapshotCacheNamespaces';

export type INamespacedSnapshotCacheConfig = {
  /**
   * Native: the dedicated MMKV file this namespace gets, as
   * `onekey-display-snapshot-<namespace>`. Web/desktop: the key space it owns
   * inside the shared UI snapshot database.
   */
  namespace: ISnapshotCacheNamespace;
  /**
   * Web / desktop: the shared store is keyed by the caller's SWR keys, so
   * clearing a namespace goes by their common prefix.
   */
  keyPrefix: string;
  /** Records older than this are a miss, and the sweep reclaims them. */
  maxAgeMs: number;
  /** How many records the namespace keeps before the oldest write is dropped. */
  maxEntries: number;
  /** Refused above this size rather than written. */
  maxRecordBytes?: number;
};
