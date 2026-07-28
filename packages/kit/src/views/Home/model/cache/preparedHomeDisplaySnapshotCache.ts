import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export const PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE = 4;

const preparedSnapshots = new Map<string, IPreparedHomeDisplaySnapshot>();

export function getPreparedHomeDisplaySnapshot(
  ownerScopeKey: string,
): IPreparedHomeDisplaySnapshot | undefined {
  const snapshot = preparedSnapshots.get(ownerScopeKey);
  if (!snapshot) {
    return undefined;
  }
  preparedSnapshots.delete(ownerScopeKey);
  preparedSnapshots.set(ownerScopeKey, snapshot);
  return snapshot;
}

export function setPreparedHomeDisplaySnapshot(
  ownerScopeKey: string,
  snapshot: IPreparedHomeDisplaySnapshot,
): string | undefined {
  preparedSnapshots.delete(ownerScopeKey);
  preparedSnapshots.set(ownerScopeKey, snapshot);
  let evictedOwnerScopeKey: string | undefined;
  while (preparedSnapshots.size > PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE) {
    const oldestOwnerScopeKey = preparedSnapshots.keys().next().value;
    if (typeof oldestOwnerScopeKey !== 'string') {
      break;
    }
    preparedSnapshots.delete(oldestOwnerScopeKey);
    evictedOwnerScopeKey = oldestOwnerScopeKey;
  }
  return evictedOwnerScopeKey;
}

export function deletePreparedHomeDisplaySnapshot(
  ownerScopeKey: string,
): boolean {
  return preparedSnapshots.delete(ownerScopeKey);
}

export function clearPreparedHomeDisplaySnapshotCache(): number {
  const clearedEntryCount = preparedSnapshots.size;
  preparedSnapshots.clear();
  return clearedEntryCount;
}

export function getPreparedHomeDisplaySnapshotCacheEntryCount(): number {
  return preparedSnapshots.size;
}
