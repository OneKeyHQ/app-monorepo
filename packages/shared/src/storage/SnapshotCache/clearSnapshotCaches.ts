import { resetWebUiSnapshotStore } from '../DisplaySnapshotStorage/webUiSnapshotStore';

/**
 * Web/desktop: every namespace shares one database, so one wipe covers the
 * ones this session never opened as well.
 */
export async function clearAllSnapshotCaches(): Promise<void> {
  await resetWebUiSnapshotStore();
}
