import {
  homeDisplaySnapshotPersistQueue,
  resetHomeDisplaySnapshotCache,
} from './homeDisplaySnapshotPersistQueue';

import type {
  IHomeStoreCommitIdentity,
  IHomeStoreState,
} from '../store/homeStoreTypes';

export function enqueueHomeDisplaySnapshotPersistJob(
  state: IHomeStoreState,
  commitIdentity: IHomeStoreCommitIdentity,
): void {
  homeDisplaySnapshotPersistQueue.enqueue(state, commitIdentity);
}

export function flushHomeDisplaySnapshotPersistQueue(): Promise<void> {
  return homeDisplaySnapshotPersistQueue.flushNow();
}

export function flushAndCompactHomeDisplaySnapshotPersistQueue(): Promise<void> {
  return homeDisplaySnapshotPersistQueue.flushAndCompact();
}

export { resetHomeDisplaySnapshotCache };
