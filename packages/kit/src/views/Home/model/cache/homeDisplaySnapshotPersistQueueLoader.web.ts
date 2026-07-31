import type {
  IHomeStoreCommitIdentity,
  IHomeStoreState,
} from '../store/homeStoreTypes';

type IHomeDisplaySnapshotPersistQueueModule =
  typeof import('./homeDisplaySnapshotPersistQueue');

let persistQueueModuleTask:
  | Promise<IHomeDisplaySnapshotPersistQueueModule>
  | undefined;

function loadHomeDisplaySnapshotPersistQueueModule(): Promise<IHomeDisplaySnapshotPersistQueueModule> {
  persistQueueModuleTask ??= import(
    /* webpackChunkName: "home-display-snapshot-persist" */ './homeDisplaySnapshotPersistQueue'
  ).catch((error: unknown) => {
    persistQueueModuleTask = undefined;
    throw error;
  });
  return persistQueueModuleTask;
}

function reportPersistQueueLoadError(error: unknown): void {
  // eslint-disable-next-line no-console
  console.error('Failed to load Home display snapshot persistence:', error);
}

async function loadHomeDisplaySnapshotPersistQueueModuleSafely(): Promise<
  IHomeDisplaySnapshotPersistQueueModule | undefined
> {
  try {
    return await loadHomeDisplaySnapshotPersistQueueModule();
  } catch (error) {
    reportPersistQueueLoadError(error);
    return undefined;
  }
}

export function enqueueHomeDisplaySnapshotPersistJob(
  state: IHomeStoreState,
  commitIdentity: IHomeStoreCommitIdentity,
): void {
  void loadHomeDisplaySnapshotPersistQueueModuleSafely().then((module) => {
    module?.homeDisplaySnapshotPersistQueue.enqueue(state, commitIdentity);
  });
}

export async function flushHomeDisplaySnapshotPersistQueue(): Promise<void> {
  const module = await loadHomeDisplaySnapshotPersistQueueModuleSafely();
  await module?.homeDisplaySnapshotPersistQueue.flushNow();
}

export async function flushAndCompactHomeDisplaySnapshotPersistQueue(): Promise<void> {
  const module = await loadHomeDisplaySnapshotPersistQueueModuleSafely();
  await module?.homeDisplaySnapshotPersistQueue.flushAndCompact();
}

export async function resetHomeDisplaySnapshotCache(): Promise<void> {
  const module = await loadHomeDisplaySnapshotPersistQueueModule();
  await module.resetHomeDisplaySnapshotCache();
}
