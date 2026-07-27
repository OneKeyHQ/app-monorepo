import {
  loadHomeDisplaySnapshotCritical,
  loadHomeDisplaySnapshotManifest,
  loadHomeDisplaySnapshotSourceRecords,
} from './homeDisplaySnapshotRepository.native';
import { selectPreparedHomeDisplaySnapshotShell } from './homeDisplaySnapshotShell';

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
  if (critical?.shell?.kind === 'loading') {
    return undefined;
  }
  const records = loadHomeDisplaySnapshotSourceRecords({
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
