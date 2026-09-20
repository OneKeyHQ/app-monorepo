/**
 * Where SWR cache entries live on disk: one UI snapshot namespace per SWR
 * namespace.
 *
 * The cache used to persist into one shared store, which meant a single file
 * for every feature, one budget they all competed for, and a startup that
 * pulled a slice of the whole thing into memory before anything asked for it.
 * A namespace now owns its own store, its own manifest and its own retention,
 * and a read names its key — so nothing is loaded until a screen wants it.
 *
 * Reads are synchronous on both platforms: MMKV on native, and on web the
 * shared map that the hydration primes. That is what lets `swrCacheUtils`
 * keep a synchronous `get`.
 */
import { createNamespacedSnapshotCache } from '../storage/SnapshotCache';
import {
  SWR_CACHE_FALLBACK_NAMESPACE,
  swrCacheNamespaceName,
} from '../storage/SnapshotCache/snapshotCacheNamespaces';

import { SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS } from './swrCacheLimits';
import { swrCacheNamespaces } from './swrCacheNamespaceNames';

import type { ISnapshotCacheSync } from '../storage/SnapshotCache';
import type { ISnapshotCacheNamespace } from '../storage/SnapshotCache/snapshotCacheNamespaces';

/** What one SWR entry looks like on disk: the payload and its write time. */
export type ISwrCacheStoredEntry = { d: unknown; t: number };

/**
 * Retention is per namespace now, so these bound one feature rather than the
 * whole cache. They are deliberately generous: a caller decides whether an
 * entry is still fresh enough to use, and this only decides when it stops
 * being worth the disk.
 */
const SWR_NAMESPACE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SWR_NAMESPACE_MAX_ENTRIES = 200;

const namespaceByPrefix = new Map<string, ISnapshotCacheNamespace>(
  Object.values(swrCacheNamespaces).map((swrNamespace) => [
    swrNamespace,
    swrCacheNamespaceName(swrNamespace),
  ]),
);

const caches = new Map<
  ISnapshotCacheNamespace,
  ISnapshotCacheSync<ISwrCacheStoredEntry>
>();

/** The leading segment of an SWR key, which is what names its namespace. */
export function swrKeyPrefix(key: string) {
  const separator = key.indexOf(':');
  return separator === -1 ? key : key.slice(0, separator);
}

export function swrKeyNamespace(key: string): ISnapshotCacheNamespace {
  return (
    namespaceByPrefix.get(swrKeyPrefix(key)) ?? SWR_CACHE_FALLBACK_NAMESPACE
  );
}

function getCache(namespace: ISnapshotCacheNamespace) {
  let cache = caches.get(namespace);
  if (!cache) {
    cache = createNamespacedSnapshotCache<ISwrCacheStoredEntry>({
      namespace,
      maxAgeMs: SWR_NAMESPACE_MAX_AGE_MS,
      maxEntries: SWR_NAMESPACE_MAX_ENTRIES,
      maxRecordBytes: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    });
    caches.set(namespace, cache);
  }
  return cache;
}

export function readSwrCacheEntry(
  key: string,
): ISwrCacheStoredEntry | undefined {
  try {
    return getCache(swrKeyNamespace(key)).get(key)?.data;
  } catch {
    return undefined;
  }
}

export function writeSwrCacheEntries(
  entries: readonly (readonly [string, ISwrCacheStoredEntry])[],
): void {
  const byNamespace = new Map<
    ISnapshotCacheNamespace,
    Array<readonly [string, ISwrCacheStoredEntry]>
  >();
  entries.forEach((entry) => {
    const namespace = swrKeyNamespace(entry[0]);
    const group = byNamespace.get(namespace);
    if (group) {
      group.push(entry);
    } else {
      byNamespace.set(namespace, [entry]);
    }
  });
  byNamespace.forEach((group, namespace) => {
    try {
      getCache(namespace).setMany(group);
    } catch {
      // One namespace that cannot be written must not stop the rest.
    }
  });
}

export function removeSwrCacheEntries(keys: readonly string[]): void {
  keys.forEach((key) => {
    try {
      getCache(swrKeyNamespace(key)).remove(key);
    } catch {
      // Best effort.
    }
  });
}

/**
 * Drop everything under a key prefix. A whole-namespace prefix — what
 * `prefixOf(namespace)` produces, and what every caller passes today — clears
 * the store outright; anything narrower is resolved through the manifest, so
 * no payload is read to decide.
 */
export function removeSwrCacheByPrefix(prefix: string): void {
  const namespace = swrKeyNamespace(prefix);
  const cache = getCache(namespace);
  try {
    if (prefix === `${swrKeyPrefix(prefix)}:`) {
      cache.clear();
      return;
    }
    cache
      .keys()
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => cache.remove(key));
  } catch {
    // Best effort.
  }
}

export function clearAllSwrCacheNamespaces(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SNAPSHOT_CACHE_NAMESPACES } =
    require('../storage/SnapshotCache/snapshotCacheNamespaces') as typeof import('../storage/SnapshotCache/snapshotCacheNamespaces');
  SNAPSHOT_CACHE_NAMESPACES.filter((namespace) =>
    namespace.startsWith('swr-'),
  ).forEach((namespace) => {
    try {
      getCache(namespace).clear();
    } catch {
      // Best effort.
    }
  });
}

/** For the idle maintenance pass: drop expired records and compact. */
export function sweepSwrCacheNamespaces(): void {
  caches.forEach((cache) => {
    try {
      cache.sweep();
    } catch {
      // Best effort.
    }
  });
}

export function __resetSwrCacheNamespaceStorageForTests() {
  caches.clear();
}
