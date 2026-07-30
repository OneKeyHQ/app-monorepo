import { createDisplaySnapshotStorage } from '@onekeyhq/shared/src/storage/DisplaySnapshotStorage';

import {
  HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE,
  createHomeDisplaySnapshotRouteRead,
  decodeHomeDisplaySnapshotCriticalRead,
  decodeHomeDisplaySnapshotManifestRead,
  decodeHomeDisplaySnapshotRouteRead,
  decodeHomeDisplaySnapshotSourceReads,
  getHomeDisplaySnapshotManifestReads,
  getHomeDisplaySnapshotSourceReadBatches,
} from './homeDisplaySnapshotRepositoryCore';

import type {
  IHomeDisplaySnapshotCritical,
  ILoadedHomeDisplaySnapshotManifest,
} from './homeDisplaySnapshotTypes';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

const homeDisplaySnapshotStorage = createDisplaySnapshotStorage({
  namespace: 'home-display',
  maxRecordBytes: 2 * 1024 * 1024,
  maxReadBatchSize: HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE,
});

export async function loadHomeDisplaySnapshotManifest({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): Promise<ILoadedHomeDisplaySnapshotManifest | undefined> {
  const { partitionId, routeKey } = createHomeDisplaySnapshotRouteRead({
    ownerScopeKey,
  });
  const routeRaw = await homeDisplaySnapshotStorage.read(routeKey);
  const routeRead = decodeHomeDisplaySnapshotRouteRead({
    ownerScopeKey,
    partitionId,
    routeRaw,
  });
  if (!routeRead) {
    return undefined;
  }

  for (const { generation, key } of getHomeDisplaySnapshotManifestReads({
    route: routeRead.route,
  })) {
    const manifestRaw = await homeDisplaySnapshotStorage.read(key);
    const context = decodeHomeDisplaySnapshotManifestRead({
      generation,
      raw: manifestRaw,
      route: routeRead.route,
      routeRaw: routeRead.routeRaw,
    });
    if (context) {
      return context;
    }
  }
  return undefined;
}

export async function loadHomeDisplaySnapshotCritical({
  context,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
}): Promise<IHomeDisplaySnapshotCritical | undefined> {
  const descriptor = context.manifest.chunks.critical;
  if (!descriptor) {
    return undefined;
  }
  return decodeHomeDisplaySnapshotCriticalRead({
    context,
    raw: await homeDisplaySnapshotStorage.read(descriptor.key),
  });
}

export async function loadHomeDisplaySnapshotSourceRecords({
  context,
  sourceIds,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
  sourceIds: readonly IHomeStoreSourceId[];
}) {
  const records: IHomeCachedSourceRecord[] = [];
  for (const reads of getHomeDisplaySnapshotSourceReadBatches({
    context,
    sourceIds,
  })) {
    const values = await homeDisplaySnapshotStorage.readMany(
      reads.map(({ descriptor }) => descriptor.key),
    );
    records.push(
      ...decodeHomeDisplaySnapshotSourceReads({ context, reads, values }),
    );
  }
  return records;
}

export { homeDisplaySnapshotStorage };
