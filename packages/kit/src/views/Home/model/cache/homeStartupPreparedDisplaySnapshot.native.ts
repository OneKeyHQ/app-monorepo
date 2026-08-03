import {
  getHomeLatestActiveAccountCacheGlobal,
  readHomeLatestActiveAccountCache,
  setHomeLatestActiveAccountCacheGlobal,
} from '@onekeyhq/shared/src/utils/homeLatestActiveAccountCache';

import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.native';

import type { IHomePreparedDisplaySnapshotHandle } from './homePreparedDisplaySnapshotHandle.types';
import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

let preparedHandle: IHomePreparedDisplaySnapshotHandle | undefined;

export function prepareHomeDisplaySnapshot({
  ownerScopeKey,
}: {
  ownerScopeKey: string;
}): IHomePreparedDisplaySnapshotHandle {
  if (
    preparedHandle?.kind === 'ready' &&
    preparedHandle.result.ownerScopeKey === ownerScopeKey
  ) {
    return preparedHandle;
  }
  let displaySnapshot: IPreparedHomeDisplaySnapshot | undefined;
  try {
    displaySnapshot = loadPreparedHomeDisplaySnapshot({ ownerScopeKey });
  } catch {
    displaySnapshot = undefined;
  }
  preparedHandle = {
    kind: 'ready',
    result: {
      displaySnapshot,
      ownerScopeKey,
    },
  };
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
