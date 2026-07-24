import { createDisplaySnapshotStorage } from '@onekeyhq/shared/src/storage/DisplaySnapshotStorage/createDisplaySnapshotStorage.native';

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
  namespace: 'home-v3',
  maxRecordBytes: 2 * 1024 * 1024,
  maxReadBatchSize: HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE,
});

export function loadHomeDisplaySnapshotManifest({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): ILoadedHomeDisplaySnapshotManifest | undefined {
  const partitionId = getHomeDisplaySnapshotPartitionId(ownerScopeKey);
  const routeKey = getHomeDisplaySnapshotRouteKey(partitionId);
  const routeRaw = homeDisplaySnapshotStorage.read(routeKey);
  const route = decodeHomeDisplaySnapshotRoute({
    raw: routeRaw,
    expectedOwnerScopeKey: ownerScopeKey,
    expectedPartitionId: partitionId,
  });
  if (!route || !routeRaw) {
    return undefined;
  }

  const generations = [
    route.currentGeneration,
    ...(route.previousGeneration ? [route.previousGeneration] : []),
  ];
  for (const generation of generations) {
    const manifestRaw = homeDisplaySnapshotStorage.read(
      getHomeDisplaySnapshotManifestKey(partitionId, generation),
    );
    const manifest = decodeHomeDisplaySnapshotManifest({
      raw: manifestRaw,
      expectedOwnerScopeKey: ownerScopeKey,
      expectedPartitionId: partitionId,
      expectedGeneration: generation,
    });
    if (manifest) {
      return { routeRaw, route, manifest };
    }
  }
  return undefined;
}

export function loadHomeDisplaySnapshotCritical({
  context,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
}): IHomeDisplaySnapshotCritical | undefined {
  const descriptor = context.manifest.chunks.critical;
  if (!descriptor) {
    return undefined;
  }
  const raw = homeDisplaySnapshotStorage.read(descriptor.key);
  if (!raw || getByteLength(raw) !== descriptor.byteLength) {
    return undefined;
  }
  return decodeHomeDisplaySnapshotCritical({
    raw,
    expectedOwnerScopeKey: context.route.ownerScopeKey,
  });
}

export function loadHomeDisplaySnapshotSourceRecords({
  context,
  sourceIds,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
  sourceIds: readonly IHomeStoreSourceId[];
}): IHomeCachedSourceRecord[] {
  const descriptors = sourceIds.flatMap((sourceId) => {
    const descriptor = context.manifest.chunks[sourceId];
    return descriptor ? [{ descriptor, sourceId }] : [];
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
    const values = homeDisplaySnapshotStorage.readMany(
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
      });
      if (record) {
        records.push(record);
      }
    });
  }
  return records;
}

export { homeDisplaySnapshotStorage };
