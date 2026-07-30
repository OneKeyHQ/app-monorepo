import { buildPreparedHomeDisplaySnapshot } from './buildPreparedHomeDisplaySnapshot';
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
  if (critical?.shell?.kind === 'loading') {
    return undefined;
  }
  const records = await loadHomeDisplaySnapshotSourceRecords({
    context,
    sourceIds: ['banner', 'portfolio', 'market'],
  });
  return buildPreparedHomeDisplaySnapshot({ critical, records });
}
