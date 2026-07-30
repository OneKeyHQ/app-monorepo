import {
  getHomeLatestActiveAccountCacheGlobal,
  readHomeLatestActiveAccountCache,
  setHomeLatestActiveAccountCacheGlobal,
} from '@onekeyhq/shared/src/utils/homeLatestActiveAccountCache';

import { loadPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.native';

import type { IPreparedHomeDisplaySnapshot } from './loadPreparedHomeDisplaySnapshot.types';

export type IHomeStartupPreparedDisplaySnapshot = {
  displaySnapshot: IPreparedHomeDisplaySnapshot | undefined;
  ownerScopeKey: string;
};

let startupPreparedDisplaySnapshot:
  | IHomeStartupPreparedDisplaySnapshot
  | null
  | undefined;

export function loadHomeStartupPreparedDisplaySnapshot():
  | IHomeStartupPreparedDisplaySnapshot
  | undefined {
  if (startupPreparedDisplaySnapshot !== undefined) {
    return startupPreparedDisplaySnapshot ?? undefined;
  }
  const latestActiveAccount =
    getHomeLatestActiveAccountCacheGlobal() ??
    readHomeLatestActiveAccountCache();
  if (!latestActiveAccount) {
    startupPreparedDisplaySnapshot = null;
    return undefined;
  }
  setHomeLatestActiveAccountCacheGlobal(latestActiveAccount);
  try {
    startupPreparedDisplaySnapshot = {
      displaySnapshot: loadPreparedHomeDisplaySnapshot({
        ownerScopeKey: latestActiveAccount.ownerScopeKey,
      }),
      ownerScopeKey: latestActiveAccount.ownerScopeKey,
    };
  } catch {
    startupPreparedDisplaySnapshot = null;
  }
  return startupPreparedDisplaySnapshot ?? undefined;
}

export function resetHomeStartupPreparedDisplaySnapshotForTest(): void {
  startupPreparedDisplaySnapshot = undefined;
}
