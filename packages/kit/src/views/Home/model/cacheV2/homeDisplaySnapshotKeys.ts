import { sha256 } from '@noble/hashes/sha256';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import type { IHomeDisplaySnapshotChunkId } from './homeDisplaySnapshotTypes';

export const HOME_DISPLAY_SNAPSHOT_ROUTE_INDEX_KEY = 'index/routes';

export function getHomeDisplaySnapshotPartitionId(
  ownerScopeKey: string,
): string {
  return bufferUtils.bytesToHex(
    sha256(new TextEncoder().encode(ownerScopeKey)),
  );
}

export function getHomeDisplaySnapshotPartitionTag(
  ownerScopeKey: string,
): string {
  return getHomeDisplaySnapshotPartitionId(ownerScopeKey).slice(0, 12);
}

export function getHomeDisplaySnapshotContentSignature(
  stableContent: string,
): string {
  return bufferUtils.bytesToHex(
    sha256(new TextEncoder().encode(stableContent)),
  );
}

export function getHomeDisplaySnapshotRouteKey(partitionId: string): string {
  return `route/${partitionId}`;
}

export function getHomeDisplaySnapshotManifestKey(
  partitionId: string,
  generation: number,
): string {
  return `manifest/${partitionId}/${generation}`;
}

export function getHomeDisplaySnapshotChunkKey(
  partitionId: string,
  generation: number,
  chunkId: IHomeDisplaySnapshotChunkId,
): string {
  return `chunk/${partitionId}/${generation}/${chunkId}`;
}
