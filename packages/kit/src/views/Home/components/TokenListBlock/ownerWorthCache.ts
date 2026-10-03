/**
 * Per-owner memory of the home token worth (OK-63873).
 *
 * `accountWorthAtom` holds ONE owner's worth map and is replaced (not merged)
 * on every switch, so between the switch and the new owner's local-cache read
 * the "Tokens · $x" subtitle resolved `calculateAccountTokensValue` against the
 * PREVIOUS owner's map (its fallback is "first value in the map") and showed a
 * wrong number for ~100 ms. This module remembers the last applied worth per
 * owner, in memory (bounded LRU) and in a small per-owner MMKV namespace, so
 * the switch can restore the target owner's worth in the same layout effect
 * that replays its token rows.
 */
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  buildTokenListOwnerSlimCacheKey,
  tokenListOwnerWorthCache,
} from '@onekeyhq/shared/src/storage/uiSnapshotCaches';

export interface IOwnerWorthSnapshot {
  worth: Record<string, string>;
  createAtNetworkWorth: string;
  /** source currency of the values (see accountWorthAtom.currency). */
  currency?: string;
}

export const OWNER_WORTH_CACHE_CAP = 8;
const OWNER_WORTH_STORE_NAME = 'homeAccountWorth';

// Insertion order doubles as recency (head = least recently used).
const memory = new Map<string, IOwnerWorthSnapshot>();

function slotKey(ownerKey: string): string {
  return buildTokenListOwnerSlimCacheKey({
    storeName: OWNER_WORTH_STORE_NAME,
    ownerKey,
  });
}

let invalidationRegistered = false;
// Bumped on every purge; see `getOwnerWorthCacheGeneration`.
let purgeGeneration = 0;

/**
 * Owner ids are reused after a wallet / account is removed (and after a wallet
 * clear), so a re-created owner must never paint the worth it had before
 * deletion. Purge memory AND the persisted namespace: the persisted slot is the
 * one that outlives the process (and, on iOS/Android, lives in native MMKV
 * shared with the `bg` runtime — clearing it here in `main` is sufficient, the
 * `bg` runtime never reads it). Registered at startup (see
 * `registerHomeTokenListOwnerCacheInvalidation`) and, as a fallback, on first
 * use.
 */
export function registerOwnerWorthCacheInvalidation(): void {
  if (invalidationRegistered) {
    return;
  }
  invalidationRegistered = true;
  const purge = () => purgeOwnerWorthCache();
  appEventBus.on(EAppEventBusNames.WalletRemove, purge);
  appEventBus.on(EAppEventBusNames.AccountRemove, purge);
  appEventBus.on(EAppEventBusNames.WalletClear, purge);
}

export function rememberOwnerWorth(
  ownerKey: string,
  snapshot: IOwnerWorthSnapshot,
): void {
  if (!ownerKey) {
    return;
  }
  registerOwnerWorthCacheInvalidation();
  memory.delete(ownerKey);
  memory.set(ownerKey, snapshot);
  while (memory.size > OWNER_WORTH_CACHE_CAP) {
    const lru = memory.keys().next().value;
    if (lru === undefined) {
      break;
    }
    memory.delete(lru);
  }
  try {
    tokenListOwnerWorthCache.set(
      slotKey(ownerKey),
      snapshot as unknown as Record<string, unknown>,
    );
  } catch {
    /* best-effort: a paint hint, never authoritative */
  }
}

/**
 * The remembered worth for `ownerKey`: memory first, then the persisted slot
 * (a fresh process). Undefined when the owner was never seen.
 */
export function getOwnerWorth(
  ownerKey: string,
): IOwnerWorthSnapshot | undefined {
  if (!ownerKey) {
    return undefined;
  }
  registerOwnerWorthCacheInvalidation();
  const hit = memory.get(ownerKey);
  if (hit) {
    memory.delete(ownerKey);
    memory.set(ownerKey, hit);
    return hit;
  }
  try {
    const key = slotKey(ownerKey);
    const record = tokenListOwnerWorthCache.get(key);
    const data = record?.data as Partial<IOwnerWorthSnapshot> | undefined;
    if (!data || typeof data.worth !== 'object' || data.worth === null) {
      return undefined;
    }
    // Same recency rule as the slim slot: a revisit keeps the owner resident.
    tokenListOwnerWorthCache.touch(key);
    const snapshot: IOwnerWorthSnapshot = {
      worth: data.worth,
      // Consumers feed this straight into BigNumber; anything but a string is
      // a corrupt record, not a value.
      createAtNetworkWorth:
        typeof data.createAtNetworkWorth === 'string'
          ? data.createAtNetworkWorth
          : '0',
      currency: typeof data.currency === 'string' ? data.currency : undefined,
    };
    memory.set(ownerKey, snapshot);
    return snapshot;
  } catch {
    return undefined;
  }
}

/** Drop every remembered owner from memory only (tests / process-local). */
export function clearOwnerWorthCache(): void {
  memory.clear();
}

/** Drop every remembered owner from memory AND the persisted namespace. */
export function purgeOwnerWorthCache(): void {
  purgeGeneration += 1;
  memory.clear();
  try {
    tokenListOwnerWorthCache.clear();
  } catch {
    /* best-effort */
  }
}

/**
 * Changes on every purge, so a caller remembering a worth from an async answer
 * can tell the cache was purged (a wallet / account removal) while it waited.
 */
export function getOwnerWorthCacheGeneration(): number {
  return purgeGeneration;
}

export function getOwnerWorthCacheSize(): number {
  return memory.size;
}
