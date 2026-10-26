import { cloneDeep } from 'lodash';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type { IDustSweepRouteParams } from '@onekeyhq/shared/types/swap/dustSweep';

import type { IDustSweepNetworksResult } from './loadNetworks';

type ICacheEntry = {
  walletId: string;
  capturedAt: number;
  result: IDustSweepNetworksResult;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 16;
const entries = new Map<string, ICacheEntry>();
// Revisions outlive cached data so eviction cannot revive pre-trade requests.
const walletRevisions = new Map<string, number>();
let identityRevision = 0;
export type IDustSweepCacheWrite = {
  key: string;
  revision: number;
};
const latestWrites = new Map<string, IDustSweepCacheWrite>();
const identityListeners = new Set<() => void>();

function getKey(params: IDustSweepRouteParams) {
  return JSON.stringify([
    params.walletId,
    params.accountId ?? '',
    params.indexedAccountId ?? '',
    params.networkId ?? '',
  ]);
}

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (now - entry.capturedAt >= CACHE_TTL_MS) entries.delete(key);
  }
}

export function getDustSweepNetworksCache(
  params: IDustSweepRouteParams,
): IDustSweepNetworksResult | undefined {
  pruneExpired();
  const key = getKey(params);
  const entry = entries.get(key);
  if (!entry) return undefined;
  entries.delete(key);
  entries.set(key, entry);
  return cloneDeep(entry.result);
}

export function setDustSweepNetworksCache(
  params: IDustSweepRouteParams,
  result: IDustSweepNetworksResult,
  write?: IDustSweepCacheWrite,
) {
  if (
    write &&
    (write.key !== getKey(params) ||
      latestWrites.get(write.key) !== write ||
      write.revision !== getDustSweepNetworksCacheRevision(params.walletId))
  )
    return;
  pruneExpired();
  const key = getKey(params);
  entries.delete(key);
  entries.set(key, {
    walletId: params.walletId,
    capturedAt: Date.now(),
    result: cloneDeep(result),
  });
  while (entries.size > MAX_CACHE_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
}

export function getDustSweepNetworksCacheRevision(walletId: string): number {
  return identityRevision + (walletRevisions.get(walletId) ?? 0);
}

export function invalidateDustSweepNetworksCache(walletId: string) {
  walletRevisions.set(walletId, (walletRevisions.get(walletId) ?? 0) + 1);
  for (const [key, entry] of entries) {
    if (entry.walletId === walletId) entries.delete(key);
  }
}

export function beginDustSweepNetworksCacheWrite(
  params: IDustSweepRouteParams,
): IDustSweepCacheWrite {
  const write = {
    key: getKey(params),
    revision: getDustSweepNetworksCacheRevision(params.walletId),
  };
  latestWrites.delete(write.key);
  latestWrites.set(write.key, write);
  while (latestWrites.size > MAX_CACHE_ENTRIES) {
    const oldest = latestWrites.keys().next().value;
    if (oldest === undefined) break;
    latestWrites.delete(oldest);
  }
  return write;
}

export function getDustSweepIdentityRevision() {
  return identityRevision;
}

export function subscribeDustSweepIdentity(listener: () => void) {
  identityListeners.add(listener);
  return () => {
    identityListeners.delete(listener);
  };
}

function invalidateIdentity() {
  identityRevision += 1;
  entries.clear();
  latestWrites.clear();
  identityListeners.forEach((listener) => listener());
}

// These events can change the real accounts behind an unchanged All Networks route.
for (const event of [
  EAppEventBusNames.AccountUpdate,
  EAppEventBusNames.AccountRemove,
  EAppEventBusNames.AddDBAccountsToWallet,
  EAppEventBusNames.WalletRemove,
  EAppEventBusNames.WalletUpdate,
  EAppEventBusNames.WalletClear,
  EAppEventBusNames.GlobalDeriveTypeUpdate,
  EAppEventBusNames.EnabledNetworksChanged,
] as const)
  appEventBus.on(event, invalidateIdentity);
