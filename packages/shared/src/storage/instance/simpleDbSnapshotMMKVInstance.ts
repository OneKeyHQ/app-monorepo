import { createDisplaySnapshotStorage } from '../DisplaySnapshotStorage/createDisplaySnapshotStorage.native';
import {
  SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_NAMES,
  extractSimpleDbSnapshotEntityName,
  simpleDbSnapshotNamespaceName,
} from '../simpleDbSnapshotEntities';
import { createSnapshotCacheSync } from '../SnapshotCache/createSnapshotCacheSync';

import type { IDisplaySnapshotStorageSync } from '../DisplaySnapshotStorage/types';
import type { ISnapshotCacheSync } from '../SnapshotCache/createSnapshotCacheSync';

const SIMPLE_DB_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SIMPLE_DB_SNAPSHOT_MAX_ENTRIES = 4;
const SIMPLE_DB_SNAPSHOT_MAX_RECORD_BYTES = 2 * 1024 * 1024;
const SIMPLE_DB_SNAPSHOT_MAX_READ_BATCH_SIZE = 8;
const COMPACT_WRITE_INTERVAL = 8;
const COMPACT_SHRINK_THRESHOLD_CHARS = 32 * 1024;
const FALLBACK_NAMESPACE = 'simple-db-cache';

type INamespaceSlot = {
  storage: IDisplaySnapshotStorageSync;
  cache: ISnapshotCacheSync<string>;
  writeCount: number;
  lastPayloadChars: Map<string, number>;
};

const slots = new Map<string, INamespaceSlot>();

function resolveNamespaceForKey(key: string): string {
  const entityName = extractSimpleDbSnapshotEntityName(key);
  return entityName
    ? simpleDbSnapshotNamespaceName(entityName)
    : FALLBACK_NAMESPACE;
}

function getSlot(namespace: string): INamespaceSlot {
  let slot = slots.get(namespace);
  if (!slot) {
    const storage = createDisplaySnapshotStorage({
      namespace,
      maxRecordBytes: SIMPLE_DB_SNAPSHOT_MAX_RECORD_BYTES,
      maxReadBatchSize: SIMPLE_DB_SNAPSHOT_MAX_READ_BATCH_SIZE,
    });
    const cache = createSnapshotCacheSync<string>({
      storage,
      retention: {
        maxAgeMs: SIMPLE_DB_SNAPSHOT_MAX_AGE_MS,
        maxEntries: SIMPLE_DB_SNAPSHOT_MAX_ENTRIES,
      },
    });
    slot = {
      storage,
      cache,
      writeCount: 0,
      lastPayloadChars: new Map(),
    };
    slots.set(namespace, slot);
  }
  return slot;
}

function getAllDeclaredNamespaces(): string[] {
  const declared = new Set<string>([
    ...SIMPLE_DB_SNAPSHOT_CACHE_ENTITY_NAMES.map(simpleDbSnapshotNamespaceName),
    FALLBACK_NAMESPACE,
    ...slots.keys(),
  ]);
  return [...declared];
}

const simpleDbSnapshotMMKVInstance = {
  getString(key: string): string | undefined {
    const slot = getSlot(resolveNamespaceForKey(key));
    return slot.cache.get(key)?.data;
  },

  getNumber(key: string): number | undefined {
    const raw = this.getString(key);
    if (raw === undefined) {
      return undefined;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : undefined;
  },

  getBoolean(key: string): boolean | undefined {
    const raw = this.getString(key);
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    return undefined;
  },

  set(key: string, value: string | number | boolean): void {
    const serialized = typeof value === 'string' ? value : String(value);
    const slot = getSlot(resolveNamespaceForKey(key));
    const previousChars = slot.lastPayloadChars.get(key) ?? 0;
    slot.cache.set(key, serialized);
    slot.writeCount += 1;
    slot.lastPayloadChars.set(key, serialized.length);
    if (
      slot.writeCount >= COMPACT_WRITE_INTERVAL ||
      (previousChars >= COMPACT_SHRINK_THRESHOLD_CHARS &&
        serialized.length * 2 < previousChars)
    ) {
      slot.writeCount = 0;
      slot.storage.compact();
    }
  },

  remove(key: string): void {
    const slot = getSlot(resolveNamespaceForKey(key));
    slot.cache.remove(key);
    slot.lastPayloadChars.delete(key);
    slot.writeCount = 0;
    slot.storage.compact();
  },

  clearAll(): void {
    getAllDeclaredNamespaces().forEach((namespace) => {
      const slot = getSlot(namespace);
      slot.cache.clear();
      slot.lastPayloadChars.clear();
      slot.writeCount = 0;
    });
  },

  getAllKeys(): string[] {
    const keys: string[] = [];
    getAllDeclaredNamespaces().forEach((namespace) => {
      const slot = getSlot(namespace);
      slot.cache.keys().forEach((key) => {
        if (slot.cache.get(key) !== undefined) {
          keys.push(key);
        }
      });
    });
    return keys;
  },

  trim(): void {
    slots.forEach((slot) => {
      slot.cache.sweep();
      slot.writeCount = 0;
      slot.storage.compact();
    });
  },
};

export default simpleDbSnapshotMMKVInstance;
