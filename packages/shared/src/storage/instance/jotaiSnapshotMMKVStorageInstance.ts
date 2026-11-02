import { createDisplaySnapshotStorage } from '../DisplaySnapshotStorage/createDisplaySnapshotStorage.native';
import { createSnapshotCacheSync } from '../SnapshotCache/createSnapshotCacheSync';

import type { IDisplaySnapshotStorageSync } from '../DisplaySnapshotStorage/types';
import type { ISnapshotCacheSync } from '../SnapshotCache/createSnapshotCacheSync';

const JOTAI_SNAPSHOT_NAMESPACE = 'jotai-cache';
const JOTAI_SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const JOTAI_SNAPSHOT_MAX_ENTRIES = 16;
const JOTAI_SNAPSHOT_MAX_RECORD_BYTES = 512 * 1024;
const JOTAI_SNAPSHOT_MAX_READ_BATCH_SIZE = 32;
const COMPACT_WRITE_INTERVAL = 8;
const COMPACT_SHRINK_THRESHOLD_CHARS = 16 * 1024;

type IJotaiSnapshotSlot = {
  storage: IDisplaySnapshotStorageSync;
  cache: ISnapshotCacheSync<string>;
  writeCount: number;
  lastPayloadChars: Map<string, number>;
};

let slotInstance: IJotaiSnapshotSlot | undefined;

function getSlot(): IJotaiSnapshotSlot {
  if (!slotInstance) {
    const storage = createDisplaySnapshotStorage({
      namespace: JOTAI_SNAPSHOT_NAMESPACE,
      maxRecordBytes: JOTAI_SNAPSHOT_MAX_RECORD_BYTES,
      maxReadBatchSize: JOTAI_SNAPSHOT_MAX_READ_BATCH_SIZE,
    });
    const cache = createSnapshotCacheSync<string>({
      storage,
      retention: {
        maxAgeMs: JOTAI_SNAPSHOT_MAX_AGE_MS,
        maxEntries: JOTAI_SNAPSHOT_MAX_ENTRIES,
      },
    });
    slotInstance = {
      storage,
      cache,
      writeCount: 0,
      lastPayloadChars: new Map(),
    };
  }
  return slotInstance;
}

const jotaiSnapshotMMKVStorageInstance = {
  getString(key: string): string | undefined {
    return getSlot().cache.get(key)?.data;
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
    const slot = getSlot();
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
    const slot = getSlot();
    slot.cache.remove(key);
    slot.lastPayloadChars.delete(key);
    slot.writeCount = 0;
    slot.storage.compact();
  },

  clearAll(): void {
    const slot = getSlot();
    slot.cache.clear();
    slot.lastPayloadChars.clear();
    slot.writeCount = 0;
  },

  getAllKeys(): string[] {
    const slot = getSlot();
    return slot.cache.keys().filter((key) => slot.cache.get(key) !== undefined);
  },

  trim(): void {
    const slot = getSlot();
    slot.cache.sweep();
    slot.writeCount = 0;
    slot.storage.compact();
  },
};

export default jotaiSnapshotMMKVStorageInstance;
