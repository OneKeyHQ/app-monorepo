import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository';
import { selectPreparedHomeDisplaySnapshotShell } from './homeDisplaySnapshotShell';

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
  const records = await loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', 'portfolio'],
  });
  const shell = selectPreparedHomeDisplaySnapshotShell({
    criticalShell: critical?.shell,
    records,
  });
  if (!shell) {
    return undefined;
  }
  return {
    context,
    navigation: critical?.navigation,
    records,
    shell,
  };
}
