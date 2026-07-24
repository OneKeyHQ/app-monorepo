import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository.native';

import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export function loadPreparedHomeDisplaySnapshot({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): IPreparedHomeDisplaySnapshot | undefined {
  const context = loadHomeDisplaySnapshotManifest({ ownerScopeKey });
  if (!context) {
    return undefined;
  }
  const critical = loadHomeDisplaySnapshotCritical({ context });
  if (!critical?.shell || critical.shell.kind === 'loading') {
    return undefined;
  }
  const records = loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', 'portfolio'],
  });
  if (
    critical.shell.kind === 'portfolio' &&
    !records.some((record) => record.sourceId === 'portfolio')
  ) {
    return undefined;
  }
  return {
    navigation: critical.navigation,
    records,
    shell: critical.shell,
  };
}
