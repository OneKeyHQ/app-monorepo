import {
  parseSnapshotCacheManifest,
  planSnapshotCacheSweep,
  planSnapshotCacheWrite,
  serializeSnapshotCacheManifest,
} from './snapshotCacheManifest';

import type { ISnapshotCacheRetentionConfig } from './snapshotCacheManifest';
import type { IDisplaySnapshotStorageSync } from '../DisplaySnapshotStorage/types';

/**
 * A time- and count-bounded cache over one snapshot storage namespace.
 *
 * Reads take a single record by exact key: no manifest read, no enumeration,
 * nothing else loaded. That is what lets a namespace hold many entries without
 * charging the app for them at startup.
 *
 * Writes also maintain the namespace manifest, and publish it as the commit
 * marker so it lands after the record it describes.
 */

export const SNAPSHOT_CACHE_MANIFEST_KEY = 'manifest';
const DATA_KEY_PREFIX = 'd:';

// Mirrors the backing store's own key rule, minus the prefix this module adds.
const CACHE_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/;
const MAX_CACHE_KEY_LENGTH = 480;

type ISnapshotCacheRecord<T> = {
  /** data */
  d: T;
  /** write timestamp (ms) */
  t: number;
};

export type ISnapshotCacheSync<T> = {
  get: (key: string) => { data: T; updatedAt: number } | undefined;
  set: (key: string, data: T) => void;
  remove: (key: string) => void;
  /** Drops expired and over-count entries, then compacts. For idle callers. */
  sweep: () => void;
  clear: () => void;
};

export function isValidSnapshotCacheKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= MAX_CACHE_KEY_LENGTH &&
    CACHE_KEY_PATTERN.test(key)
  );
}

export function createSnapshotCacheSync<T>({
  storage,
  retention,
  now = () => Date.now(),
}: {
  storage: IDisplaySnapshotStorageSync;
  retention: ISnapshotCacheRetentionConfig;
  now?: () => number;
}): ISnapshotCacheSync<T> {
  const dataKey = (key: string) => `${DATA_KEY_PREFIX}${key}`;

  const readManifest = () => {
    const raw = storage.read(SNAPSHOT_CACHE_MANIFEST_KEY);
    return { raw, manifest: parseSnapshotCacheManifest(raw) };
  };

  const commitManifest = ({
    raw,
    manifest,
    entries,
    removeKeys,
  }: {
    raw: string | undefined;
    manifest: ReturnType<typeof parseSnapshotCacheManifest>;
    entries: Array<{ key: string; value: string }>;
    removeKeys: string[];
  }) => {
    storage.commit({
      entries,
      commitMarker: {
        key: SNAPSHOT_CACHE_MANIFEST_KEY,
        value: serializeSnapshotCacheManifest(manifest),
      },
      expectedCommitMarker: { key: SNAPSHOT_CACHE_MANIFEST_KEY, value: raw },
      removeKeys: removeKeys.map(dataKey),
    });
  };

  return {
    get(key) {
      if (!isValidSnapshotCacheKey(key)) {
        return undefined;
      }
      try {
        const raw = storage.read(dataKey(key));
        if (!raw) {
          return undefined;
        }
        const record = JSON.parse(raw) as ISnapshotCacheRecord<T> | null;
        if (!record || typeof record.t !== 'number') {
          return undefined;
        }
        // A record can outlive its manifest entry when a write was cut short,
        // so age is enforced here too rather than trusting the manifest.
        if (now() - record.t >= retention.maxAgeMs) {
          return undefined;
        }
        return { data: record.d, updatedAt: record.t };
      } catch {
        return undefined;
      }
    },

    set(key, data) {
      if (!isValidSnapshotCacheKey(key)) {
        return;
      }
      const write = (attempt: number) => {
        const timestamp = now();
        const { raw, manifest } = readManifest();
        const plan = planSnapshotCacheWrite({
          manifest,
          key,
          updatedAt: timestamp,
          config: retention,
          now: timestamp,
        });
        try {
          commitManifest({
            raw,
            manifest: plan.manifest,
            entries: [
              {
                key: dataKey(key),
                value: JSON.stringify({ d: data, t: timestamp }),
              },
            ],
            removeKeys: plan.removeKeys,
          });
        } catch {
          // A concurrent writer moved the marker; re-read and try once more.
          if (attempt === 0) {
            write(attempt + 1);
          }
        }
      };
      try {
        write(0);
      } catch {
        // Persisting a snapshot must never fail the caller.
      }
    },

    remove(key) {
      if (!isValidSnapshotCacheKey(key)) {
        return;
      }
      try {
        const { raw, manifest } = readManifest();
        const { [key]: removed, ...rest } = manifest.e;
        if (removed === undefined) {
          storage.remove([dataKey(key)]);
          return;
        }
        commitManifest({
          raw,
          manifest: { ...manifest, e: rest },
          entries: [],
          removeKeys: [key],
        });
      } catch {
        // Best effort.
      }
    },

    sweep() {
      try {
        const { raw, manifest } = readManifest();
        const plan = planSnapshotCacheSweep({
          manifest,
          config: retention,
          now: now(),
        });
        if (!plan.changed) {
          return;
        }
        commitManifest({
          raw,
          manifest: plan.manifest,
          entries: [],
          removeKeys: plan.removeKeys,
        });
        storage.compact();
      } catch {
        // Best effort.
      }
    },

    clear() {
      try {
        storage.clearNamespace();
      } catch {
        // Best effort.
      }
    },
  };
}
