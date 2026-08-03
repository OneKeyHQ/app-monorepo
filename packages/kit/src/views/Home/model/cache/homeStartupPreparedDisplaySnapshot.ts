import {
  getHomeLatestActiveAccountCacheGlobal,
  readHomeLatestActiveAccountCache,
  setHomeLatestActiveAccountCacheGlobal,
} from '@onekeyhq/shared/src/utils/homeLatestActiveAccountCache';

import type {
  IHomePreparedDisplaySnapshotHandle,
  IHomePreparedDisplaySnapshotResult,
} from './homePreparedDisplaySnapshotHandle.types';

let preparedHandle: IHomePreparedDisplaySnapshotHandle | undefined;

export function prepareHomeDisplaySnapshot({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): IHomePreparedDisplaySnapshotHandle {
  const existingOwnerScopeKey =
    preparedHandle?.kind === 'ready'
      ? preparedHandle.result.ownerScopeKey
      : preparedHandle?.ownerScopeKey;
  if (preparedHandle && existingOwnerScopeKey === ownerScopeKey) {
    return preparedHandle;
  }
  const task = import('./loadPreparedHomeDisplaySnapshot').then(
    ({ loadPreparedHomeDisplaySnapshot }) =>
      loadPreparedHomeDisplaySnapshot({ ownerScopeKey }),
  );
  const resultTask = task.then(
    (displaySnapshot): IHomePreparedDisplaySnapshotResult => ({
      displaySnapshot,
      ownerScopeKey,
    }),
    (): IHomePreparedDisplaySnapshotResult => ({
      displaySnapshot: undefined,
      ownerScopeKey,
    }),
  );
  preparedHandle = {
    kind: 'pending',
    ownerScopeKey,
    task: resultTask,
  };
  void resultTask.then((result) => {
    if (
      preparedHandle?.kind === 'pending' &&
      preparedHandle.task === resultTask
    ) {
      preparedHandle = { kind: 'ready', result };
    }
  });
  return preparedHandle;
}

export function loadHomeStartupPreparedDisplaySnapshot():
  | IHomePreparedDisplaySnapshotHandle
  | undefined {
  const latestActiveAccount =
    getHomeLatestActiveAccountCacheGlobal() ??
    readHomeLatestActiveAccountCache();
  if (!latestActiveAccount) {
    return undefined;
  }
  setHomeLatestActiveAccountCacheGlobal(latestActiveAccount);
  return prepareHomeDisplaySnapshot({
    ownerScopeKey: latestActiveAccount.ownerScopeKey,
  });
}

export function resetHomeStartupPreparedDisplaySnapshotForTest(): void {
  preparedHandle = undefined;
}
