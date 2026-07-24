import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository';

import type {
  IHomeNavigationSemanticModel,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';
import type { IHomeCachedSourceRecord } from '../store/homeStoreTypes';

export type IPreparedHomeDisplaySnapshot = {
  navigation?: IHomeNavigationSemanticModel;
  records: readonly IHomeCachedSourceRecord[];
  selectedTabPreference?: IHomeTabId;
  shell?: IHomeShellSemanticModel;
};

export async function loadPreparedHomeDisplaySnapshot({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): Promise<IPreparedHomeDisplaySnapshot | undefined> {
  const context = await loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  if (!context) {
    return undefined;
  }
  const critical = await loadHomeDisplaySnapshotCritical({ context });
  if (!critical?.shell || critical.shell.kind === 'loading') {
    return undefined;
  }
  const selectedSourceId = critical?.selectedTabPreference ?? 'portfolio';
  const records = await loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', selectedSourceId],
  });
  return {
    navigation: critical?.navigation,
    records,
    selectedTabPreference: critical?.selectedTabPreference,
    shell: critical?.shell,
  };
}
