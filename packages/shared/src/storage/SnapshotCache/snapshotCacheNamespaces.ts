/**
 * Every UI snapshot namespace the app declares.
 *
 * Listed here rather than discovered, because two callers need the whole set
 * before the modules that declare them have necessarily been imported: the
 * app's own "clear data", which must leave nothing behind, and the idle sweep
 * that reclaims expired records. A namespace missing from this list would be
 * invisible to both.
 */
export const SNAPSHOT_CACHE_NAMESPACES = ['market-token-detail'] as const;

export type ISnapshotCacheNamespace =
  (typeof SNAPSHOT_CACHE_NAMESPACES)[number];
