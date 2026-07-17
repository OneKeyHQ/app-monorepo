import { registerColdStartFlushTrigger } from '@onekeyhq/shared/src/storage/coldStartFlushTrigger';
import { coldStartCacheStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';

import type { ISwapStockDisplaySnapshot } from './swapStockDisplaySnapshotUtils';

const SWAP_STOCK_DISPLAY_STORE_VERSION = 1 as const;
const SWAP_STOCK_DISPLAY_MAX_ACCOUNTS = 8;
const SWAP_STOCK_DISPLAY_FLUSH_DEBOUNCE_MS = 500;

type ISwapStockDisplayStoreEntry = {
  snapshot: ISwapStockDisplaySnapshot;
  updatedAt: number;
};

type ISwapStockDisplayStore = {
  version: typeof SWAP_STOCK_DISPLAY_STORE_VERSION;
  entries: Record<string, ISwapStockDisplayStoreEntry>;
};

let storeCache: ISwapStockDisplayStore | undefined;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let dirty = false;
let flushTriggerRegistered = false;
const runtimeResetGeneration = resetUtils.getResetGeneration();
const runtimeInitializedDuringReset = resetUtils.getIsResetting();

function discardRuntimeStore(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  storeCache = undefined;
  dirty = false;
}

function isRuntimeStoreDisabled(): boolean {
  if (
    !runtimeInitializedDuringReset &&
    !resetUtils.getIsResetting() &&
    resetUtils.getResetGeneration() === runtimeResetGeneration
  ) {
    return false;
  }
  discardRuntimeStore();
  return true;
}

function buildAccountSlotKey(accountKey: string) {
  return encodeURIComponent(accountKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function omitRuntimeOnlyAmount(
  snapshot: ISwapStockDisplaySnapshot,
): ISwapStockDisplaySnapshot {
  const persistentSnapshot = { ...snapshot };
  delete persistentSnapshot.amount;
  return persistentSnapshot;
}

function buildPersistentStore(
  store: ISwapStockDisplayStore,
): ISwapStockDisplayStore {
  return {
    ...store,
    entries: Object.fromEntries(
      Object.entries(store.entries).map(([slotKey, entry]) => [
        slotKey,
        {
          ...entry,
          snapshot: omitRuntimeOnlyAmount(entry.snapshot),
        },
      ]),
    ),
  };
}

function readStore(): ISwapStockDisplayStore {
  if (storeCache) {
    return storeCache;
  }
  try {
    const stored = coldStartCacheStorage.getObject<unknown>(
      EAppSyncStorageKeys.onekey_swap_stock_display_snapshot,
    );
    if (
      isRecord(stored) &&
      stored.version === SWAP_STOCK_DISPLAY_STORE_VERSION &&
      isRecord(stored.entries)
    ) {
      const entries: Record<string, ISwapStockDisplayStoreEntry> = {};
      Object.entries(stored.entries).forEach(([slotKey, entry]) => {
        if (
          !isRecord(entry) ||
          !Number.isFinite(entry.updatedAt) ||
          !isRecord(entry.snapshot) ||
          !isRecord(entry.snapshot.identity) ||
          typeof entry.snapshot.identity.accountKey !== 'string' ||
          slotKey !== buildAccountSlotKey(entry.snapshot.identity.accountKey)
        ) {
          return;
        }
        entries[slotKey] = {
          // Amount input follows ordinary Swap semantics: it is scoped to the
          // current UI runtime and must never hydrate from a previous process.
          snapshot: omitRuntimeOnlyAmount(
            entry.snapshot as ISwapStockDisplaySnapshot,
          ),
          updatedAt: entry.updatedAt as number,
        };
      });
      storeCache = {
        version: SWAP_STOCK_DISPLAY_STORE_VERSION,
        entries,
      };
      return storeCache;
    }
  } catch {
    // Display restoration is best-effort and must never block Swap startup.
  }
  storeCache = {
    version: SWAP_STOCK_DISPLAY_STORE_VERSION,
    entries: {},
  };
  return storeCache;
}

function flushNow(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  if (isRuntimeStoreDisabled()) {
    return;
  }
  if (!dirty || !storeCache) {
    return;
  }
  try {
    coldStartCacheStorage.setObject(
      EAppSyncStorageKeys.onekey_swap_stock_display_snapshot,
      buildPersistentStore(storeCache),
    );
    dirty = false;
  } catch {
    // Keep the in-memory projection dirty so a later checkpoint can retry.
  }
}

function ensureFlushTrigger(): void {
  if (flushTriggerRegistered) {
    return;
  }
  try {
    registerColdStartFlushTrigger(flushNow);
    flushTriggerRegistered = true;
  } catch {
    // The debounce timer remains a sufficient best-effort fallback.
  }
}

function scheduleFlush(): void {
  ensureFlushTrigger();
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(flushNow, SWAP_STOCK_DISPLAY_FLUSH_DEBOUNCE_MS);
}

function get(accountKey: string): ISwapStockDisplaySnapshot | undefined {
  if (!accountKey || isRuntimeStoreDisabled()) {
    return undefined;
  }
  return readStore().entries[buildAccountSlotKey(accountKey)]?.snapshot;
}

function set(accountKey: string, snapshot: ISwapStockDisplaySnapshot): void {
  if (!accountKey || isRuntimeStoreDisabled()) {
    return;
  }
  try {
    const store = readStore();
    const slotKey = buildAccountSlotKey(accountKey);
    const entries = {
      ...store.entries,
      [slotKey]: {
        snapshot,
        updatedAt: snapshot.updatedAt,
      },
    };
    const sortedEntries = Object.entries(entries).toSorted(
      ([, left], [, right]) => right.updatedAt - left.updatedAt,
    );
    const boundedEntries = Object.fromEntries(
      sortedEntries.slice(0, SWAP_STOCK_DISPLAY_MAX_ACCOUNTS),
    );
    storeCache = {
      version: SWAP_STOCK_DISPLAY_STORE_VERSION,
      entries: boundedEntries,
    };
    dirty = true;
    scheduleFlush();
  } catch {
    // A failed checkpoint only forfeits the next cold-start restoration.
  }
}

function reload(): void {
  if (isRuntimeStoreDisabled()) {
    return;
  }
  flushNow();
  storeCache = undefined;
  dirty = false;
}

export const swapStockDisplaySnapshotStorage = {
  flushNow,
  get,
  reload,
  set,
};
