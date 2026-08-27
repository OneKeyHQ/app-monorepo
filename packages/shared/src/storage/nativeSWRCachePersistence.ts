/* cspell:ignore ISWR */
import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '../errors';
import {
  SWR_CACHE_MAX_ENTRIES,
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  SWR_CACHE_MAX_SERIALIZED_CHARS,
  pruneSWRCacheStore,
  reportSWRCacheCapacityDrops,
} from '../utils/swrCacheUtils';

import { syncNativeStorageMMKV } from './nativeStorageMigrationModule';
import { parseNativeSWRCachePatchIntent } from './nativeStorageTypes';

import type {
  INativeSWRCacheCanonicalEntry,
  INativeSWRCachePatchIntent,
} from './nativeStorageTypes';
import type { ISWRCacheCapacityDrop } from '../utils/swrCacheUtils';

type SWRCacheEntry = { t: number; [key: string]: unknown };
type SWRCacheStore = Record<string, SWRCacheEntry>;

type MMKVStorageInstance = {
  getAllKeys(): string[];
  getString(key: string): string | undefined;
  remove(key: string): void;
  set(key: string, value: string): void;
};

type IPersistenceState = {
  store: SWRCacheStore | undefined;
};

type IReadSerializedSubsetOptions = {
  keyPrefixes: readonly string[];
  maxEntries: number;
  maxSerializedChars: number;
};

type ISerializedSubsetCandidate = {
  index: number;
  key: string;
  physicalKey: string;
  serializedChars: number;
  serializedKey: string;
  updatedAt: number;
};

const LEGACY_SWR_CACHE_KEY = 'onekey_swr_cache';
const SWR_CACHE_ENTRY_PREFIX = '__onekey_internal_swr_cache_v2_entry__:';
const SWR_CACHE_MIGRATION_MARKER = '__onekey_internal_swr_cache_v2_migrated__';
const SWR_CACHE_MIGRATION_MARKER_VALUE = '1';
const SWR_CACHE_MAX_LEGACY_PARSE_CHARS = SWR_CACHE_MAX_SERIALIZED_CHARS * 2;

const persistenceStates = new WeakMap<object, IPersistenceState>();

function getPersistenceState(mmkv: MMKVStorageInstance) {
  let state = persistenceStates.get(mmkv as object);
  if (!state) {
    state = { store: undefined };
    persistenceStates.set(mmkv as object, state);
  }
  return state;
}

function defineStoreEntry(
  store: SWRCacheStore,
  key: string,
  entry: SWRCacheEntry,
) {
  Object.defineProperty(store, key, {
    configurable: true,
    enumerable: true,
    value: entry,
    writable: true,
  });
}

function parseEntry(serialized: string): SWRCacheEntry | undefined {
  if (serialized.length > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (
      !isPlainObject(parsed) ||
      !Number.isSafeInteger((parsed as { t?: unknown }).t) ||
      ((parsed as { t: number }).t as number) < 0
    ) {
      return undefined;
    }
    return parsed as SWRCacheEntry;
  } catch {
    return undefined;
  }
}

function parseStore(serialized: string | undefined): SWRCacheStore {
  if (!serialized || serialized.length > SWR_CACHE_MAX_LEGACY_PARSE_CHARS) {
    return {};
  }
  try {
    const parsed = JSON.parse(serialized) as unknown;
    if (!isPlainObject(parsed)) {
      return {};
    }
    const store: SWRCacheStore = {};
    const entryLimitDrops: ISWRCacheCapacityDrop[] = [];
    Object.entries(parsed as Record<string, unknown>).forEach(
      ([key, value]) => {
        let serializedEntry: string | undefined;
        try {
          serializedEntry = JSON.stringify(value);
        } catch {
          serializedEntry = undefined;
        }
        if (
          serializedEntry &&
          serializedEntry.length > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS
        ) {
          entryLimitDrops.push({
            entrySerializedChars: serializedEntry.length,
            key,
            reason: 'entryLimit',
          });
        }
        const entry = serializedEntry ? parseEntry(serializedEntry) : undefined;
        if (entry) {
          defineStoreEntry(store, key, entry);
        }
      },
    );
    const pruned = pruneSWRCacheStore(store);
    reportSWRCacheCapacityDrops(entryLimitDrops, {
      maxEntries: SWR_CACHE_MAX_ENTRIES,
      maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
      maxSerializedChars: SWR_CACHE_MAX_SERIALIZED_CHARS,
      retainedEntryCount: Object.keys(pruned.store).length,
      retainedSerializedChars: pruned.serialized.length,
    });
    return pruned.store as SWRCacheStore;
  } catch {
    return {};
  }
}

function serializeStore(store: SWRCacheStore) {
  return pruneSWRCacheStore(store).serialized;
}

function getPhysicalEntryKey(key: string) {
  return `${SWR_CACHE_ENTRY_PREFIX}${key}`;
}

export function isNativeSWRCachePhysicalKey(key: string) {
  return (
    key === SWR_CACHE_MIGRATION_MARKER || key.startsWith(SWR_CACHE_ENTRY_PREFIX)
  );
}

function clearPhysicalEntries(mmkv: MMKVStorageInstance) {
  mmkv.getAllKeys().forEach((key) => {
    if (key.startsWith(SWR_CACHE_ENTRY_PREFIX)) {
      mmkv.remove(key);
    }
  });
}

function persistStoreEntry(
  mmkv: MMKVStorageInstance,
  key: string,
  entry: SWRCacheEntry | undefined,
) {
  const physicalKey = getPhysicalEntryKey(key);
  if (entry) {
    mmkv.set(physicalKey, JSON.stringify(entry));
  } else {
    mmkv.remove(physicalKey);
  }
}

function migrateLegacyStoreSynchronously(mmkv: MMKVStorageInstance) {
  const state = getPersistenceState(mmkv);
  const store = parseStore(mmkv.getString(LEGACY_SWR_CACHE_KEY));
  clearPhysicalEntries(mmkv);
  Object.entries(store).forEach(([key, entry]) => {
    persistStoreEntry(mmkv, key, entry);
  });
  mmkv.set(SWR_CACHE_MIGRATION_MARKER, SWR_CACHE_MIGRATION_MARKER_VALUE);
  state.store = store;
  return store;
}

function loadPhysicalStore(mmkv: MMKVStorageInstance) {
  const state = getPersistenceState(mmkv);
  if (state.store) {
    return state.store;
  }
  if (
    mmkv.getString(SWR_CACHE_MIGRATION_MARKER) !==
    SWR_CACHE_MIGRATION_MARKER_VALUE
  ) {
    const legacy = parseStore(mmkv.getString(LEGACY_SWR_CACHE_KEY));
    state.store = legacy;
    return legacy;
  }

  const store: SWRCacheStore = {};
  const entryLimitDrops: ISWRCacheCapacityDrop[] = [];
  const invalidPhysicalKeys: string[] = [];
  mmkv.getAllKeys().forEach((physicalKey) => {
    if (!physicalKey.startsWith(SWR_CACHE_ENTRY_PREFIX)) {
      return;
    }
    const key = physicalKey.slice(SWR_CACHE_ENTRY_PREFIX.length);
    const serialized = mmkv.getString(physicalKey);
    if (
      serialized &&
      serialized.length > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS
    ) {
      entryLimitDrops.push({
        entrySerializedChars: serialized.length,
        key,
        reason: 'entryLimit',
      });
    }
    const entry = serialized ? parseEntry(serialized) : undefined;
    if (!entry) {
      invalidPhysicalKeys.push(physicalKey);
      return;
    }
    defineStoreEntry(store, key, entry);
  });
  invalidPhysicalKeys.forEach((key) => mmkv.remove(key));
  const pruned = pruneSWRCacheStore(store);
  pruned.removedKeys.forEach((key) => {
    delete store[key];
    mmkv.remove(getPhysicalEntryKey(key));
  });
  reportSWRCacheCapacityDrops(entryLimitDrops, {
    maxEntries: SWR_CACHE_MAX_ENTRIES,
    maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    maxSerializedChars: SWR_CACHE_MAX_SERIALIZED_CHARS,
    retainedEntryCount: Object.keys(pruned.store).length,
    retainedSerializedChars: pruned.serialized.length,
  });
  state.store = store;
  return store;
}

function readSerializedSubset(
  mmkv: MMKVStorageInstance,
  { keyPrefixes, maxEntries, maxSerializedChars }: IReadSerializedSubsetOptions,
) {
  if (
    maxEntries <= 0 ||
    maxSerializedChars < 2 ||
    keyPrefixes.length === 0 ||
    mmkv.getString(SWR_CACHE_MIGRATION_MARKER) !==
      SWR_CACHE_MIGRATION_MARKER_VALUE
  ) {
    return '{}';
  }

  const candidates: ISerializedSubsetCandidate[] = [];
  const entryLimitDrops: ISWRCacheCapacityDrop[] = [];
  const bootstrapSizeDrops: ISWRCacheCapacityDrop[] = [];
  const invalidPhysicalKeys: string[] = [];
  mmkv.getAllKeys().forEach((physicalKey, index) => {
    if (!physicalKey.startsWith(SWR_CACHE_ENTRY_PREFIX)) {
      return;
    }
    const key = physicalKey.slice(SWR_CACHE_ENTRY_PREFIX.length);
    if (!keyPrefixes.some((prefix) => key.startsWith(prefix))) {
      return;
    }
    const serialized = mmkv.getString(physicalKey);
    if (!serialized) {
      invalidPhysicalKeys.push(physicalKey);
      return;
    }
    const serializedKey = JSON.stringify(key);
    const pairSerializedChars = serializedKey.length + 1 + serialized.length;
    if (serialized.length > SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS) {
      invalidPhysicalKeys.push(physicalKey);
      entryLimitDrops.push({
        entrySerializedChars: serialized.length,
        key,
        reason: 'entryLimit',
      });
      return;
    }
    if (pairSerializedChars + 2 > maxSerializedChars) {
      bootstrapSizeDrops.push({
        entrySerializedChars: serialized.length,
        key,
        reason: 'bootstrapSizeLimit',
      });
      return;
    }
    const entry = parseEntry(serialized);
    if (!entry) {
      invalidPhysicalKeys.push(physicalKey);
      return;
    }
    candidates.push({
      index,
      key,
      physicalKey,
      serializedChars: serialized.length,
      serializedKey,
      updatedAt: entry.t,
    });
  });
  invalidPhysicalKeys.forEach((key) => mmkv.remove(key));
  const candidateSerializedChars = candidates.reduce(
    (total, candidate, index) =>
      total +
      (index > 0 ? 1 : 0) +
      candidate.serializedKey.length +
      1 +
      candidate.serializedChars,
    2,
  );
  reportSWRCacheCapacityDrops(entryLimitDrops, {
    maxEntries: SWR_CACHE_MAX_ENTRIES,
    maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    maxSerializedChars: SWR_CACHE_MAX_SERIALIZED_CHARS,
    retainedEntryCount: candidates.length,
    retainedSerializedChars: candidateSerializedChars,
  });

  candidates.sort(
    (left, right) =>
      right.updatedAt - left.updatedAt || right.index - left.index,
  );
  const retained: Array<ISerializedSubsetCandidate & { pair: string }> = [];
  const bootstrapEntryCountDrops: ISWRCacheCapacityDrop[] = [];
  let totalSerializedChars = 2;
  for (
    let candidateIndex = 0;
    candidateIndex < candidates.length;
    candidateIndex += 1
  ) {
    const candidate = candidates[candidateIndex];
    if (retained.length >= maxEntries) {
      candidates.slice(candidateIndex).forEach((omittedCandidate) => {
        bootstrapEntryCountDrops.push({
          entrySerializedChars: omittedCandidate.serializedChars,
          key: omittedCandidate.key,
          reason: 'bootstrapEntryCountLimit',
        });
      });
      break;
    }
    const separatorChars = retained.length > 0 ? 1 : 0;
    const pairSerializedChars =
      candidate.serializedKey.length + 1 + candidate.serializedChars;
    const fitsPayloadBudget =
      totalSerializedChars + separatorChars + pairSerializedChars <=
      maxSerializedChars;
    if (fitsPayloadBudget) {
      const serialized = mmkv.getString(candidate.physicalKey);
      const currentEntry = serialized ? parseEntry(serialized) : undefined;
      if (
        serialized &&
        serialized.length === candidate.serializedChars &&
        currentEntry?.t === candidate.updatedAt
      ) {
        retained.push({
          ...candidate,
          pair: `${candidate.serializedKey}:${serialized}`,
        });
        totalSerializedChars += separatorChars + pairSerializedChars;
      }
    } else {
      bootstrapSizeDrops.push({
        entrySerializedChars: candidate.serializedChars,
        key: candidate.key,
        reason: 'bootstrapSizeLimit',
      });
    }
  }
  retained.sort((left, right) => left.index - right.index);
  const bootstrapCapacityLimits = {
    maxEntries,
    maxEntrySerializedChars: SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
    maxSerializedChars,
    retainedEntryCount: retained.length,
    retainedSerializedChars: totalSerializedChars,
  };
  reportSWRCacheCapacityDrops(
    bootstrapEntryCountDrops,
    bootstrapCapacityLimits,
  );
  reportSWRCacheCapacityDrops(bootstrapSizeDrops, bootstrapCapacityLimits);
  return `{${retained.map(({ pair }) => pair).join(',')}}`;
}

function applyPatchToStore(
  store: SWRCacheStore,
  patch: INativeSWRCachePatchIntent,
) {
  const affectedKeys = new Set<string>();
  const removeIfNotNewer = (key: string, removedAt: number) => {
    const current = store[key];
    if (current && current.t <= removedAt) {
      delete store[key];
    }
    affectedKeys.add(key);
  };

  if (patch.clearBefore !== undefined) {
    Object.keys(store).forEach((key) =>
      removeIfNotNewer(key, patch.clearBefore as number),
    );
  }
  patch.removePrefixes.forEach(({ at, prefix }) => {
    Object.keys(store).forEach((key) => {
      if (key.startsWith(prefix)) {
        removeIfNotNewer(key, at);
      }
    });
  });
  patch.removals.forEach(([key, removedAt]) => {
    removeIfNotNewer(key, removedAt);
  });
  patch.updates.forEach(([key, serializedEntry]) => {
    const incoming = parseEntry(serializedEntry);
    if (!incoming) {
      throw new OneKeyLocalError('Native SWR cache patch entry is invalid');
    }
    const current = store[key];
    if (!current || incoming.t >= current.t) {
      defineStoreEntry(store, key, incoming);
    }
    affectedKeys.add(key);
  });

  const pruned = pruneSWRCacheStore(store);
  pruned.removedKeys.forEach((key) => {
    delete store[key];
    affectedKeys.add(key);
  });
  const entries: INativeSWRCacheCanonicalEntry[] = [...affectedKeys].map(
    (key) => [key, store[key] ? JSON.stringify(store[key]) : null] as const,
  );
  return { entries, store };
}

export function applyNativeSWRCachePatchToSerializedStore(
  serializedStore: string | undefined,
  patchValue: unknown,
) {
  const patch = parseNativeSWRCachePatchIntent(patchValue);
  if (!patch) {
    throw new OneKeyLocalError('Native SWR cache patch is invalid');
  }
  const result = applyPatchToStore(parseStore(serializedStore), patch);
  return { entries: result.entries, serialized: serializeStore(result.store) };
}

export function applyNativeSWRCacheCanonicalEntries(
  serializedStore: string | undefined,
  entries: INativeSWRCacheCanonicalEntry[],
) {
  const store = parseStore(serializedStore);
  entries.forEach(([key, serializedEntry]) => {
    if (serializedEntry === null) {
      delete store[key];
      return;
    }
    const entry = parseEntry(serializedEntry);
    if (!entry) {
      throw new OneKeyLocalError('Native SWR cache canonical entry is invalid');
    }
    defineStoreEntry(store, key, entry);
  });
  return serializeStore(store);
}

export function getNativeSWRCachePersistence(mmkv: MMKVStorageInstance) {
  return {
    async ensureMigrated() {
      let migratedLegacyStore = false;
      try {
        if (
          mmkv.getString(SWR_CACHE_MIGRATION_MARKER) !==
          SWR_CACHE_MIGRATION_MARKER_VALUE
        ) {
          migrateLegacyStoreSynchronously(mmkv);
          migratedLegacyStore = true;
          await syncNativeStorageMMKV('onekey-cold-start-cache');
        }
        if (mmkv.getString(LEGACY_SWR_CACHE_KEY) !== undefined) {
          mmkv.remove(LEGACY_SWR_CACHE_KEY);
          await syncNativeStorageMMKV('onekey-cold-start-cache');
        }
      } finally {
        if (migratedLegacyStore) {
          getPersistenceState(mmkv).store = undefined;
        }
      }
    },
    readSerialized() {
      return serializeStore(loadPhysicalStore(mmkv));
    },
    readSerializedSubset(options: IReadSerializedSubsetOptions) {
      return readSerializedSubset(mmkv, options);
    },
    applyPatch(patchValue: unknown) {
      const patch = parseNativeSWRCachePatchIntent(patchValue);
      if (!patch) {
        throw new OneKeyLocalError('Native SWR cache patch is invalid');
      }
      if (
        mmkv.getString(SWR_CACHE_MIGRATION_MARKER) !==
        SWR_CACHE_MIGRATION_MARKER_VALUE
      ) {
        migrateLegacyStoreSynchronously(mmkv);
        mmkv.remove(LEGACY_SWR_CACHE_KEY);
      }
      const store = loadPhysicalStore(mmkv);
      const result = applyPatchToStore(store, patch);
      result.entries.forEach(([key]) =>
        persistStoreEntry(mmkv, key, result.store[key]),
      );
      return result.entries;
    },
    replaceSerialized(serializedStore: string) {
      const previous = loadPhysicalStore(mmkv);
      const next = parseStore(serializedStore);
      const keys = new Set([...Object.keys(previous), ...Object.keys(next)]);
      keys.forEach((key) => persistStoreEntry(mmkv, key, next[key]));
      mmkv.set(SWR_CACHE_MIGRATION_MARKER, SWR_CACHE_MIGRATION_MARKER_VALUE);
      mmkv.remove(LEGACY_SWR_CACHE_KEY);
      getPersistenceState(mmkv).store = next;
      return [...keys].map(
        (key) => [key, next[key] ? JSON.stringify(next[key]) : null] as const,
      );
    },
    invalidate() {
      persistenceStates.delete(mmkv as object);
    },
  };
}
