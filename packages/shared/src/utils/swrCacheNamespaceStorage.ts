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
import {
  createNamespacedSnapshotCache,
  isValidSnapshotCacheKey,
} from '../storage/SnapshotCache';
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

/**
 * What a namespace may hold as a key is narrower than what an SWR key may be:
 * the cache accepts any string up to 20,000 characters, a record key is
 * `[A-Za-z0-9][A-Za-z0-9._:/-]*` and at most 480. A token symbol, an account
 * label or a long address set puts a key outside that set, and the storage
 * layer answers by dropping it — silently, on both write and read.
 *
 * So a key that does not fit is stored under a digest of itself instead. The
 * leading segment is kept, both so a namespace-wide prefix still matches and
 * so the record stays readable.
 */
function digestOf(key: string) {
  // Two FNV-1a passes with different offsets: 64 bits, which is far more than
  // a namespace's few hundred keys need to stay collision-free, and cheap
  // enough for a read path.
  let low = 0x81_1c_9d_c5;
  let high = 0x01_00_01_93;
  for (let index = 0; index < key.length; index += 1) {
    const code = key.charCodeAt(index);
    low = Math.imul(low ^ code, 0x01_00_01_93) >>> 0;
    high = Math.imul(high ^ (code + index), 0x85_eb_ca_6b) >>> 0;
  }
  return `${low.toString(36)}${high.toString(36)}`;
}

/** Marks a digested record, in characters the record key rule allows. */
const DIGEST_MARKER = '__digest__';

function toStorageKey(key: string) {
  if (isValidSnapshotCacheKey(key)) {
    return key;
  }
  const prefix = swrKeyPrefix(key);
  const safePrefix = isValidSnapshotCacheKey(prefix) ? prefix : 'swr';
  return `${safePrefix}:${DIGEST_MARKER}${digestOf(key)}`;
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
    return getCache(swrKeyNamespace(key)).get(toStorageKey(key))?.data;
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
      getCache(namespace).setMany(
        group.map(([key, entry]) => [toStorageKey(key), entry] as const),
      );
    } catch {
      // One namespace that cannot be written must not stop the rest.
    }
  });
}

export function removeSwrCacheEntries(keys: readonly string[]): void {
  keys.forEach((key) => {
    try {
      getCache(swrKeyNamespace(key)).remove(toStorageKey(key));
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
    const keys = cache.keys();
    // A digested key carries nothing of the original past its namespace, so a
    // narrower prefix cannot be matched against it. Clearing the namespace
    // drops more than asked, which for a cache costs a refetch; leaving a key
    // the caller asked to invalidate would cost correctness.
    if (
      keys.some((key) =>
        key.startsWith(`${swrKeyPrefix(prefix)}:${DIGEST_MARKER}`),
      )
    ) {
      cache.clear();
      return;
    }
    keys
      .filter((key) => key.startsWith(prefix))
      .forEach((key) => cache.remove(key));
  } catch {
    // Best effort.
  }
}

/**
 * Clear SWR namespaces from the store itself.
 *
 * Driven off the storage layer's own list, not the key registry: a key whose
 * leading segment names no declared namespace is written to
 * `SWR_CACHE_FALLBACK_NAMESPACE`, so `defiEnabled:<networkId>` and friends
 * live in a namespace no `swrKeys` entry mentions. Walking the registry would
 * leave them behind.
 *
 * `exceptSwrPrefixes` names SWR prefixes to keep (`perpsL2Book`), which is how
 * a caller spares the namespaces another runtime writes.
 */
export function clearAllSwrCacheNamespaces(options?: {
  exceptSwrPrefixes?: readonly string[];
}): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SNAPSHOT_CACHE_NAMESPACES } =
    require('../storage/SnapshotCache/snapshotCacheNamespaces') as typeof import('../storage/SnapshotCache/snapshotCacheNamespaces');
  const kept = new Set(
    (options?.exceptSwrPrefixes ?? []).map((prefix) =>
      swrCacheNamespaceName(prefix),
    ),
  );
  SNAPSHOT_CACHE_NAMESPACES.filter(
    (namespace) => namespace.startsWith('swr-') && !kept.has(namespace),
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
