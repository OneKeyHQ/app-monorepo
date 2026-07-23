import { createDisplaySnapshotStorage } from '@onekeyhq/shared/src/storage/DisplaySnapshotStorage';

import {
  decodeHomeDisplaySnapshotCritical,
  decodeHomeDisplaySnapshotManifest,
  decodeHomeDisplaySnapshotRoute,
  decodeHomeDisplaySnapshotSourceChunk,
  getByteLength,
} from './homeDisplaySnapshotCodec';
import {
  getHomeDisplaySnapshotManifestKey,
  getHomeDisplaySnapshotPartitionId,
  getHomeDisplaySnapshotRouteKey,
} from './homeDisplaySnapshotKeys';

import type {
  IHomeDisplaySnapshotCritical,
  ILoadedHomeDisplaySnapshotManifest,
} from './homeDisplaySnapshotTypes';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

const HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE = 4;

const homeDisplaySnapshotStorage = createDisplaySnapshotStorage({
  namespace: 'home-v2',
  maxRecordBytes: 2 * 1024 * 1024,
  maxReadBatchSize: HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE,
});

export async function loadHomeDisplaySnapshotManifest({
  now,
  ownerScopeKey,
}: {
  now: number;
  ownerScopeKey: string;
}): Promise<ILoadedHomeDisplaySnapshotManifest | undefined> {
  const partitionId = getHomeDisplaySnapshotPartitionId(ownerScopeKey);
  const routeKey = getHomeDisplaySnapshotRouteKey(partitionId);
  const routeRaw = await homeDisplaySnapshotStorage.read(routeKey);
  const route = decodeHomeDisplaySnapshotRoute({
    raw: routeRaw,
    expectedOwnerScopeKey: ownerScopeKey,
    expectedPartitionId: partitionId,
    now,
  });
  if (!route || !routeRaw) {
    return undefined;
  }

  const generations = [
    route.currentGeneration,
    ...(route.previousGeneration ? [route.previousGeneration] : []),
  ];
  for (const generation of generations) {
    const manifestRaw = await homeDisplaySnapshotStorage.read(
      getHomeDisplaySnapshotManifestKey(partitionId, generation),
    );
    const manifest = decodeHomeDisplaySnapshotManifest({
      raw: manifestRaw,
      expectedOwnerScopeKey: ownerScopeKey,
      expectedPartitionId: partitionId,
      expectedGeneration: generation,
      now,
    });
    if (manifest) {
      return { routeRaw, route, manifest };
    }
  }
  return undefined;
}

export async function loadHomeDisplaySnapshotCritical({
  context,
  now,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
  now: number;
}): Promise<IHomeDisplaySnapshotCritical | undefined> {
  const descriptor = context.manifest.chunks.critical;
  if (!descriptor || descriptor.expiresAt <= now) {
    return undefined;
  }
  const raw = await homeDisplaySnapshotStorage.read(descriptor.key);
  if (!raw || getByteLength(raw) !== descriptor.byteLength) {
    return undefined;
  }
  return decodeHomeDisplaySnapshotCritical({
    raw,
    expectedOwnerScopeKey: context.route.ownerScopeKey,
    now,
  });
}

export async function loadHomeDisplaySnapshotSourceRecords({
  context,
  now,
  sourceIds,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
  now: number;
  sourceIds: readonly IHomeStoreSourceId[];
}) {
  const descriptors = sourceIds.flatMap((sourceId) => {
    const descriptor = context.manifest.chunks[sourceId];
    return descriptor && descriptor.expiresAt > now
      ? [{ descriptor, sourceId }]
      : [];
  });
  const records: IHomeCachedSourceRecord[] = [];
  for (
    let offset = 0;
    offset < descriptors.length;
    offset += HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE
  ) {
    const batch = descriptors.slice(
      offset,
      offset + HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE,
    );
    const values = await homeDisplaySnapshotStorage.readMany(
      batch.map(({ descriptor }) => descriptor.key),
    );
    batch.forEach(({ descriptor, sourceId }) => {
      const raw = values.get(descriptor.key);
      if (!raw || getByteLength(raw) !== descriptor.byteLength) {
        return;
      }
      const record = decodeHomeDisplaySnapshotSourceChunk({
        raw,
        expectedOwnerScopeKey: context.route.ownerScopeKey,
        expectedSourceId: sourceId,
        now,
      });
      if (record) {
        records.push(record);
      }
    });
  }
  return records;
}

export { homeDisplaySnapshotStorage };
