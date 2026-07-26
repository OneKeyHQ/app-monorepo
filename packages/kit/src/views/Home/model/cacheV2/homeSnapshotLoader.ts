import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository';

import type { ILoadedHomeDisplaySnapshotManifest } from './homeDisplaySnapshotTypes';
import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
} from '../semantic/homeSemanticTypes';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

export interface IHomeInitialSnapshotLoad {
  context: ILoadedHomeDisplaySnapshotManifest;
  navigation?: IHomeNavigationSemanticModel;
  records: readonly IHomeCachedSourceRecord[];
  shell?: IHomeShellSemanticModel;
}

export async function loadHomeInitialSnapshot(
  ownerScopeKey: string,
): Promise<IHomeInitialSnapshotLoad | undefined> {
  const context = await loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  if (!context) {
    return undefined;
  }
  const critical = await loadHomeDisplaySnapshotCritical({ context });
  const records = await loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', 'portfolio'],
  });
  if (!critical && records.length === 0) {
    return undefined;
  }
  return {
    context,
    navigation: critical?.navigation,
    records,
    shell: critical?.shell,
  };
}

export function loadHomeSnapshotSource(
  context: ILoadedHomeDisplaySnapshotManifest,
  sourceId: IHomeStoreSourceId,
): Promise<readonly IHomeCachedSourceRecord[]> {
  return loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: [sourceId],
  });
}
