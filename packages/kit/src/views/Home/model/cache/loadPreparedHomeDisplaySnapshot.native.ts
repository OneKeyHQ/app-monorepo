import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getHomeDisplaySnapshotPartitionTag } from './homeDisplaySnapshotKeys';
import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository.native';
import { selectPreparedHomeDisplaySnapshotShell } from './homeDisplaySnapshotShell';
import {
  PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE,
  getPreparedHomeDisplaySnapshot,
  getPreparedHomeDisplaySnapshotCacheEntryCount,
  setPreparedHomeDisplaySnapshot,
} from './preparedHomeDisplaySnapshotCache';

import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export function loadPreparedHomeDisplaySnapshot({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): IPreparedHomeDisplaySnapshot | undefined {
  const startedAt = Date.now();
  const partitionTag = getHomeDisplaySnapshotPartitionTag(ownerScopeKey);
  const cached = getPreparedHomeDisplaySnapshot(ownerScopeKey);
  if (cached) {
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'preparedMemory',
      outcome: 'hit',
      partitionTag,
      elapsedMs: Date.now() - startedAt,
      recordCount: cached.records.length,
      generation: cached.context.manifest?.generation,
      cacheEntryCount: getPreparedHomeDisplaySnapshotCacheEntryCount(),
      cacheCapacity: PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE,
    });
    return cached;
  }
  defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
    stage: 'preparedMemory',
    outcome: 'miss',
    partitionTag,
    elapsedMs: Date.now() - startedAt,
    recordCount: 0,
    cacheEntryCount: getPreparedHomeDisplaySnapshotCacheEntryCount(),
    cacheCapacity: PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE,
  });
  const context = loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  if (!context) {
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'preparedStorage',
      outcome: 'miss',
      partitionTag,
      elapsedMs: Date.now() - startedAt,
      recordCount: 0,
      reason: 'manifestMissing',
    });
    return undefined;
  }
  const critical = loadHomeDisplaySnapshotCritical({ context });
  if (critical?.shell?.kind === 'loading') {
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'preparedStorage',
      outcome: 'miss',
      partitionTag,
      elapsedMs: Date.now() - startedAt,
      recordCount: 0,
      generation: context.manifest?.generation,
      reason: 'loadingShell',
    });
    return undefined;
  }
  const records = loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', 'portfolio'],
  });
  const shell = selectPreparedHomeDisplaySnapshotShell({
    criticalShell: critical?.shell,
    records,
  });
  if (!shell) {
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'preparedStorage',
      outcome: 'miss',
      partitionTag,
      elapsedMs: Date.now() - startedAt,
      recordCount: records.length,
      generation: context.manifest?.generation,
      reason: 'shellRejected',
    });
    return undefined;
  }
  const snapshot = {
    context,
    navigation: critical?.navigation,
    records,
    shell,
  };
  const evictedOwnerScopeKey = setPreparedHomeDisplaySnapshot(
    ownerScopeKey,
    snapshot,
  );
  if (evictedOwnerScopeKey) {
    defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
      stage: 'preparedMemory',
      outcome: 'evicted',
      partitionTag: getHomeDisplaySnapshotPartitionTag(evictedOwnerScopeKey),
      elapsedMs: 0,
      recordCount: 0,
      cacheEntryCount: getPreparedHomeDisplaySnapshotCacheEntryCount(),
      cacheCapacity: PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE,
      reason: 'capacity',
    });
  }
  defaultLogger.wallet.homeUi.homeDisplaySnapshotCache({
    stage: 'preparedStorage',
    outcome: 'accepted',
    partitionTag,
    elapsedMs: Date.now() - startedAt,
    recordCount: records.length,
    generation: context.manifest?.generation,
    cacheEntryCount: getPreparedHomeDisplaySnapshotCacheEntryCount(),
    cacheCapacity: PREPARED_HOME_DISPLAY_SNAPSHOT_CACHE_SIZE,
  });
  return snapshot;
}
