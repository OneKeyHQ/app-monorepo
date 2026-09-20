/**
 * Retention bookkeeping for a snapshot cache namespace.
 *
 * The backing storage exposes no enumeration API on purpose, so a namespace
 * keeps its own index of `key -> write timestamp`. Only writes and the idle
 * sweep touch it; reads go straight to the record they want.
 *
 * These functions are pure so the retention rules stay testable without a
 * storage backend.
 */

export const SNAPSHOT_CACHE_MANIFEST_VERSION = 1;

export type ISnapshotCacheManifest = {
  /** version */
  v: number;
  /** entries: cache key -> write timestamp (ms) */
  e: Record<string, number>;
};

export type ISnapshotCacheRetentionConfig = {
  maxEntries: number;
  maxAgeMs: number;
};

export type ISnapshotCacheRetentionPlan = {
  manifest: ISnapshotCacheManifest;
  removeKeys: string[];
  changed: boolean;
};

export function createEmptySnapshotCacheManifest(): ISnapshotCacheManifest {
  return { v: SNAPSHOT_CACHE_MANIFEST_VERSION, e: {} };
}

// A manifest is a cache of a cache: anything unreadable or written by a newer
// version starts over rather than failing the caller.
export function parseSnapshotCacheManifest(
  raw: string | undefined,
): ISnapshotCacheManifest {
  if (!raw) {
    return createEmptySnapshotCacheManifest();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ISnapshotCacheManifest> | null;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      parsed.v !== SNAPSHOT_CACHE_MANIFEST_VERSION ||
      !parsed.e ||
      typeof parsed.e !== 'object'
    ) {
      return createEmptySnapshotCacheManifest();
    }
    const entries: Record<string, number> = {};
    Object.entries(parsed.e).forEach(([key, timestamp]) => {
      if (
        key &&
        typeof timestamp === 'number' &&
        Number.isSafeInteger(timestamp) &&
        timestamp >= 0
      ) {
        entries[key] = timestamp;
      }
    });
    return { v: SNAPSHOT_CACHE_MANIFEST_VERSION, e: entries };
  } catch {
    return createEmptySnapshotCacheManifest();
  }
}

export function serializeSnapshotCacheManifest(
  manifest: ISnapshotCacheManifest,
): string {
  return JSON.stringify(manifest);
}

function planRetention(
  entries: Record<string, number>,
  { maxEntries, maxAgeMs }: ISnapshotCacheRetentionConfig,
  now: number,
  protectedKey?: string,
): { entries: Record<string, number>; removeKeys: string[] } {
  const removeKeys: string[] = [];
  const kept: Array<[string, number]> = [];
  Object.entries(entries).forEach(([key, timestamp]) => {
    if (key !== protectedKey && now - timestamp >= maxAgeMs) {
      removeKeys.push(key);
      return;
    }
    kept.push([key, timestamp]);
  });
  // Oldest write goes first once the namespace is full. The key being written
  // is never the victim, so a single write cannot evict itself.
  kept.sort(
    (left, right) => left[1] - right[1] || (left[0] < right[0] ? -1 : 1),
  );
  while (kept.length > maxEntries) {
    const victimIndex = kept.findIndex(([key]) => key !== protectedKey);
    if (victimIndex < 0) {
      break;
    }
    removeKeys.push(kept[victimIndex][0]);
    kept.splice(victimIndex, 1);
  }
  return { entries: Object.fromEntries(kept), removeKeys };
}

export function planSnapshotCacheWrite({
  manifest,
  key,
  updatedAt,
  config,
  now,
}: {
  manifest: ISnapshotCacheManifest;
  key: string;
  updatedAt: number;
  config: ISnapshotCacheRetentionConfig;
  now: number;
}): ISnapshotCacheRetentionPlan {
  const { entries, removeKeys } = planRetention(
    { ...manifest.e, [key]: updatedAt },
    config,
    now,
    key,
  );
  return {
    manifest: { v: SNAPSHOT_CACHE_MANIFEST_VERSION, e: entries },
    removeKeys,
    changed: true,
  };
}

export function planSnapshotCacheSweep({
  manifest,
  config,
  now,
}: {
  manifest: ISnapshotCacheManifest;
  config: ISnapshotCacheRetentionConfig;
  now: number;
}): ISnapshotCacheRetentionPlan {
  const { entries, removeKeys } = planRetention(manifest.e, config, now);
  return {
    manifest: { v: SNAPSHOT_CACHE_MANIFEST_VERSION, e: entries },
    removeKeys,
    changed: removeKeys.length > 0,
  };
}
