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
  IHomeDisplaySnapshotChunkDescriptor,
  IHomeDisplaySnapshotCritical,
  IHomeDisplaySnapshotRoute,
  ILoadedHomeDisplaySnapshotManifest,
} from './homeDisplaySnapshotTypes';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

export const HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE = 4;

export type IHomeDisplaySnapshotSourceRead = {
  descriptor: IHomeDisplaySnapshotChunkDescriptor;
  sourceId: IHomeStoreSourceId;
};

export function createHomeDisplaySnapshotRouteRead({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}) {
  const partitionId = getHomeDisplaySnapshotPartitionId(ownerScopeKey);
  return {
    ownerScopeKey,
    partitionId,
    routeKey: getHomeDisplaySnapshotRouteKey(partitionId),
  };
}

export function decodeHomeDisplaySnapshotRouteRead({
  ownerScopeKey,
  partitionId,
  routeRaw,
}: {
  ownerScopeKey: string;
  partitionId: string;
  routeRaw: string | undefined;
}):
  | {
      route: IHomeDisplaySnapshotRoute;
      routeRaw: string;
    }
  | undefined {
  const route = decodeHomeDisplaySnapshotRoute({
    raw: routeRaw,
    expectedOwnerScopeKey: ownerScopeKey,
    expectedPartitionId: partitionId,
  });
  if (!route || !routeRaw) {
    return undefined;
  }
  return { route, routeRaw };
}

export function getHomeDisplaySnapshotManifestReads({
  route,
}: {
  route: IHomeDisplaySnapshotRoute;
}) {
  return [
    route.currentGeneration,
    ...(route.previousGeneration ? [route.previousGeneration] : []),
  ].map((generation) => ({
    generation,
    key: getHomeDisplaySnapshotManifestKey(route.partitionId, generation),
  }));
}

export function decodeHomeDisplaySnapshotManifestRead({
  generation,
  raw,
  route,
  routeRaw,
}: {
  generation: number;
  raw: string | undefined;
  route: IHomeDisplaySnapshotRoute;
  routeRaw: string;
}): ILoadedHomeDisplaySnapshotManifest | undefined {
  const manifest = decodeHomeDisplaySnapshotManifest({
    raw,
    expectedOwnerScopeKey: route.ownerScopeKey,
    expectedPartitionId: route.partitionId,
    expectedGeneration: generation,
  });
  return manifest ? { routeRaw, route, manifest } : undefined;
}

export function decodeHomeDisplaySnapshotCriticalRead({
  context,
  raw,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
  raw: string | undefined;
}): IHomeDisplaySnapshotCritical | undefined {
  const descriptor = context.manifest.chunks.critical;
  if (!descriptor || !raw || getByteLength(raw) !== descriptor.byteLength) {
    return undefined;
  }
  return decodeHomeDisplaySnapshotCritical({
    raw,
    expectedOwnerScopeKey: context.route.ownerScopeKey,
  });
}

export function getHomeDisplaySnapshotSourceReadBatches({
  context,
  sourceIds,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
  sourceIds: readonly IHomeStoreSourceId[];
}): IHomeDisplaySnapshotSourceRead[][] {
  const reads = sourceIds.flatMap((sourceId) => {
    const descriptor = context.manifest.chunks[sourceId];
    return descriptor ? [{ descriptor, sourceId }] : [];
  });
  const batches: IHomeDisplaySnapshotSourceRead[][] = [];
  for (
    let offset = 0;
    offset < reads.length;
    offset += HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE
  ) {
    batches.push(
      reads.slice(offset, offset + HOME_DISPLAY_SNAPSHOT_READ_BATCH_SIZE),
    );
  }
  return batches;
}

export function decodeHomeDisplaySnapshotSourceReads({
  context,
  reads,
  values,
}: {
  context: ILoadedHomeDisplaySnapshotManifest;
  reads: readonly IHomeDisplaySnapshotSourceRead[];
  values: ReadonlyMap<string, string>;
}): IHomeCachedSourceRecord[] {
  return reads.flatMap(({ descriptor, sourceId }) => {
    const raw = values.get(descriptor.key);
    if (!raw || getByteLength(raw) !== descriptor.byteLength) {
      return [];
    }
    const record = decodeHomeDisplaySnapshotSourceChunk({
      raw,
      expectedOwnerScopeKey: context.route.ownerScopeKey,
      expectedSourceId: sourceId,
    });
    return record ? [record] : [];
  });
}
