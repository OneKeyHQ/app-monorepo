import { coldStartCacheStorage } from '../storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import { buildHomeRuntimeOwnerScopeKey } from './homeRuntimeIdentity';

import type { IHomeRuntimeOwnerScope } from '../types/homeRuntime';

export const HOME_LATEST_ACTIVE_ACCOUNT_CACHE_VERSION = 1;

export type IHomeLatestActiveAccountCache = {
  activeAccount: Record<string, unknown>;
  owner: IHomeRuntimeOwnerScope;
  ownerScopeKey: string;
  updatedAt: number;
  version: typeof HOME_LATEST_ACTIVE_ACCOUNT_CACHE_VERSION;
};

type IHomeLatestActiveAccountGlobal = typeof globalThis & {
  __ONEKEY_HOME_LATEST_ACTIVE_ACCOUNT_CACHE__?: IHomeLatestActiveAccountCache;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function parseOwner(value: unknown): IHomeRuntimeOwnerScope | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { accountId, network, walletId } = value;
  if (
    typeof walletId !== 'string' ||
    walletId.length === 0 ||
    typeof accountId !== 'string' ||
    accountId.length === 0 ||
    !isRecord(network)
  ) {
    return undefined;
  }
  if (network.kind === 'allNetworks') {
    return {
      accountId,
      network: { kind: 'allNetworks' },
      walletId,
    };
  }
  if (
    network.kind === 'singleNetwork' &&
    typeof network.networkId === 'string' &&
    network.networkId.length > 0
  ) {
    return {
      accountId,
      network: {
        kind: 'singleNetwork',
        networkId: network.networkId,
      },
      walletId,
    };
  }
  return undefined;
}

export function parseHomeLatestActiveAccountCache(
  value: unknown,
): IHomeLatestActiveAccountCache | undefined {
  if (
    !isRecord(value) ||
    value.version !== HOME_LATEST_ACTIVE_ACCOUNT_CACHE_VERSION ||
    !Number.isSafeInteger(value.updatedAt) ||
    (value.updatedAt as number) <= 0 ||
    typeof value.ownerScopeKey !== 'string' ||
    !isRecord(value.activeAccount)
  ) {
    return undefined;
  }
  const owner = parseOwner(value.owner);
  if (!owner || value.ownerScopeKey !== buildHomeRuntimeOwnerScopeKey(owner)) {
    return undefined;
  }
  return {
    activeAccount: value.activeAccount,
    owner,
    ownerScopeKey: value.ownerScopeKey,
    updatedAt: value.updatedAt as number,
    version: HOME_LATEST_ACTIVE_ACCOUNT_CACHE_VERSION,
  };
}

export function createHomeLatestActiveAccountCache({
  activeAccount,
  owner,
  updatedAt = Date.now(),
}: {
  activeAccount: Record<string, unknown>;
  owner: IHomeRuntimeOwnerScope;
  updatedAt?: number;
}): IHomeLatestActiveAccountCache {
  return {
    activeAccount,
    owner,
    ownerScopeKey: buildHomeRuntimeOwnerScopeKey(owner),
    updatedAt,
    version: HOME_LATEST_ACTIVE_ACCOUNT_CACHE_VERSION,
  };
}

export function readHomeLatestActiveAccountCache():
  | IHomeLatestActiveAccountCache
  | undefined {
  return parseHomeLatestActiveAccountCache(
    coldStartCacheStorage.getObject<Partial<IHomeLatestActiveAccountCache>>(
      EAppSyncStorageKeys.onekey_home_latest_active_account,
    ),
  );
}

export function writeHomeLatestActiveAccountCache(
  cache: IHomeLatestActiveAccountCache,
): void {
  coldStartCacheStorage.setObject(
    EAppSyncStorageKeys.onekey_home_latest_active_account,
    cache,
  );
  setHomeLatestActiveAccountCacheGlobal(cache);
}

export function clearHomeLatestActiveAccountCache(): void {
  coldStartCacheStorage.delete(
    EAppSyncStorageKeys.onekey_home_latest_active_account,
  );
  delete (globalThis as IHomeLatestActiveAccountGlobal)
    .__ONEKEY_HOME_LATEST_ACTIVE_ACCOUNT_CACHE__;
}

export function getHomeLatestActiveAccountCacheGlobal():
  | IHomeLatestActiveAccountCache
  | undefined {
  return parseHomeLatestActiveAccountCache(
    (globalThis as IHomeLatestActiveAccountGlobal)
      .__ONEKEY_HOME_LATEST_ACTIVE_ACCOUNT_CACHE__,
  );
}

export function setHomeLatestActiveAccountCacheGlobal(
  value: IHomeLatestActiveAccountCache,
): void {
  (
    globalThis as IHomeLatestActiveAccountGlobal
  ).__ONEKEY_HOME_LATEST_ACTIVE_ACCOUNT_CACHE__ = value;
}
