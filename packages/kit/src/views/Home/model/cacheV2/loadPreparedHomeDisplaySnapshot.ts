import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository';

import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

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
  const records = await loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', 'portfolio', 'market'],
  });
  if (
    critical.shell.kind === 'portfolio' &&
    !records.some((record) => record.sourceId === 'portfolio')
  ) {
    return undefined;
  }
  return {
    navigation: critical?.navigation,
    records,
    shell: critical?.shell,
  };
}
