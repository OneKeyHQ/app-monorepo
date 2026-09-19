// Per-entry SWR cache persistence for the web/desktop cold-start store.
//
// The legacy layout kept the whole SWR store as one JSON string under
// `onekey_swr_cache`, so every flush parsed, merged and re-serialized all
// namespaces and IndexedDB rewrote that single record. Here every SWR key is
// its own record (same physical key format as the native per-entry cache), so
// swrCacheUtils takes its entries-source path and a flush touches only the
// keys it names.

import { isPlainObject } from 'lodash';

import {
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  isValidSWRCacheKey,
} from '../../utils/swrCacheLimits';
import { EAppSyncStorageKeys } from '../syncStorageKeys';

import type {
  INativeSWRCacheEntriesListener,
  INativeSWRCachePatchIntent,
  INativeSWRCacheSerializedEntry,
} from '../nativeStorageTypes';

export const WEB_SWR_CACHE_ENTRY_PREFIX =
  '__onekey_internal_swr_cache_v2_entry__:';

const LEGACY_SWR_CACHE_KEY: string = EAppSyncStorageKeys.onekey_swr_cache;

export type IWebSWRCacheEntriesBackend = {
  keys: () => Iterable<string>;
  get: (key: string) => unknown;
  set: (key: string, value: string) => void;
  delete: (key: string) => void;
};

export function isWebSWRCachePersistedKey(key: string): boolean {
  return (
    key === LEGACY_SWR_CACHE_KEY || key.startsWith(WEB_SWR_CACHE_ENTRY_PREFIX)
  );
}

function getPhysicalKey(key: string) {
  return `${WEB_SWR_CACHE_ENTRY_PREFIX}${key}`;
}

// Same acceptance rule as the native per-entry store: a plain object carrying
// a non-negative safe-integer timestamp.
function readEntryTimestamp(serialized: unknown): number | undefined {
  if (
    typeof serialized !== 'string' ||
    serialized.length > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS
  ) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    const t = isPlainObject(parsed) ? (parsed as { t?: unknown }).t : undefined;
    return Number.isSafeInteger(t) && (t as number) >= 0
      ? (t as number)
      : undefined;
  } catch {
    return undefined;
  }
}

export function createWebSWRCacheEntries(backend: IWebSWRCacheEntriesBackend) {
  const listeners = new Set<INativeSWRCacheEntriesListener>();

  const listPhysicalKeys = () =>
    Array.from(backend.keys()).filter((key) =>
      key.startsWith(WEB_SWR_CACHE_ENTRY_PREFIX),
    );

  // Splits a legacy whole-store blob into per-entry records once. A record
  // already written per entry wins unless the blob holds a newer copy.
  const migrateLegacyStore = () => {
    const raw = backend.get(LEGACY_SWR_CACHE_KEY);
    if (raw === undefined) {
      return;
    }
    let parsed: unknown;
    try {
      parsed = typeof raw === 'string' && raw ? JSON.parse(raw) : undefined;
    } catch {
      parsed = undefined;
    }
    if (isPlainObject(parsed)) {
      Object.entries(parsed as Record<string, unknown>).forEach(
        ([key, entry]) => {
          if (!isValidSWRCacheKey(key)) {
            return;
          }
          let serialized: string | undefined;
          try {
            serialized = JSON.stringify(entry);
          } catch {
            serialized = undefined;
          }
          const incomingAt = readEntryTimestamp(serialized);
          if (serialized === undefined || incomingAt === undefined) {
            return;
          }
          const physicalKey = getPhysicalKey(key);
          const currentAt = readEntryTimestamp(backend.get(physicalKey));
          if (currentAt === undefined || incomingAt > currentAt) {
            backend.set(physicalKey, serialized);
          }
        },
      );
    }
    backend.delete(LEGACY_SWR_CACHE_KEY);
  };

  // A record that is unreadable, or not newer than the deletion, goes away.
  const removeIfNotNewer = (physicalKey: string, removedAt: number) => {
    const currentAt = readEntryTimestamp(backend.get(physicalKey));
    if (currentAt === undefined || currentAt <= removedAt) {
      backend.delete(physicalKey);
    }
  };

  return {
    readSWRCacheEntries(): INativeSWRCacheSerializedEntry[] {
      migrateLegacyStore();
      const entries: INativeSWRCacheSerializedEntry[] = [];
      listPhysicalKeys().forEach((physicalKey) => {
        const serialized = backend.get(physicalKey);
        if (typeof serialized === 'string') {
          entries.push([
            physicalKey.slice(WEB_SWR_CACHE_ENTRY_PREFIX.length),
            serialized,
          ]);
        }
      });
      return entries;
    },

    // Same order and timestamp rules as the native per-entry store:
    // deletions first, each only when the record is not newer, then updates
    // unless the record already holds a newer entry.
    applySWRCachePatch(patch: INativeSWRCachePatchIntent) {
      migrateLegacyStore();
      if (patch.clearBefore !== undefined || patch.removePrefixes.length) {
        listPhysicalKeys().forEach((physicalKey) => {
          const key = physicalKey.slice(WEB_SWR_CACHE_ENTRY_PREFIX.length);
          if (patch.clearBefore !== undefined) {
            removeIfNotNewer(physicalKey, patch.clearBefore);
          }
          patch.removePrefixes.forEach(({ at, prefix }) => {
            if (key.startsWith(prefix)) {
              removeIfNotNewer(physicalKey, at);
            }
          });
        });
      }
      patch.removals.forEach(([key, removedAt]) => {
        removeIfNotNewer(getPhysicalKey(key), removedAt);
      });
      patch.updates.forEach(([key, serialized]) => {
        const incomingAt = readEntryTimestamp(serialized);
        if (!isValidSWRCacheKey(key) || incomingAt === undefined) {
          return;
        }
        const physicalKey = getPhysicalKey(key);
        const currentAt = readEntryTimestamp(backend.get(physicalKey));
        if (currentAt === undefined || incomingAt >= currentAt) {
          backend.set(physicalKey, serialized);
        }
      });
    },

    subscribeSWRCacheEntries(listener: INativeSWRCacheEntriesListener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    // Records primed after swrCacheUtils first read the store (late IndexedDB
    // hydration) must reach it; `null` asks it to re-read every entry.
    notifyEntriesReplaced() {
      listeners.forEach((listener) => listener(null));
    },
  };
}
