import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository.native';

import type { ILoadedHomeDisplaySnapshotManifest } from './homeDisplaySnapshotTypes';
import type { IHomeInitialSnapshotLoad } from './homeSnapshotLoader';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

export function loadHomeInitialSnapshot(
  ownerScopeKey: string,
): IHomeInitialSnapshotLoad | undefined {
  const context = loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  if (!context) {
    return undefined;
  }
  const critical = loadHomeDisplaySnapshotCritical({ context });
  if (!critical) {
    return undefined;
  }
  return {
    context,
    navigation: critical.navigation,
    records: loadHomeDisplaySnapshotSourceRecords({
      context,
      sourceIds: ['banner', 'portfolio'],
    }),
    shell: critical.shell,
  };
}

export function loadHomeSnapshotSource(
  context: ILoadedHomeDisplaySnapshotManifest,
  sourceId: IHomeStoreSourceId,
): readonly IHomeCachedSourceRecord[] {
  return loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: [sourceId],
  });
}
