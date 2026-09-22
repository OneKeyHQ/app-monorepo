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

export function rememberOwnerWorth(
  ownerKey: string,
  snapshot: IOwnerWorthSnapshot,
): void {
  if (!ownerKey) {
    return;
  }
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
  const hit = memory.get(ownerKey);
  if (hit) {
    memory.delete(ownerKey);
    memory.set(ownerKey, hit);
    return hit;
  }
  try {
    const record = tokenListOwnerWorthCache.get(slotKey(ownerKey));
    const data = record?.data as Partial<IOwnerWorthSnapshot> | undefined;
    if (!data || typeof data.worth !== 'object' || data.worth === null) {
      return undefined;
    }
    const snapshot: IOwnerWorthSnapshot = {
      worth: data.worth,
      createAtNetworkWorth: data.createAtNetworkWorth ?? '0',
      currency: data.currency,
    };
    memory.set(ownerKey, snapshot);
    return snapshot;
  } catch {
    return undefined;
  }
}

/** Drop every remembered owner (tests / wallet removal). */
export function clearOwnerWorthCache(): void {
  memory.clear();
}

export function getOwnerWorthCacheSize(): number {
  return memory.size;
}
