import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import { getHomeSourceKeyIdentity } from '../core/homeIdentity';

import type {
  IHomeCachedSourceRecord,
  IHomeStoreResourceSlot,
  IHomeStoreSourceId,
} from './homeStoreTypes';

const HOME_STORE_CACHE_TTL_MS = 5 * 60 * 1000;

function createCacheRecord({
  now,
  slot,
  sourceId,
}: {
  now: number;
  slot: IHomeStoreResourceSlot<IHomeRuntimeJsonValue>;
  sourceId: IHomeStoreSourceId;
}): IHomeCachedSourceRecord | undefined {
  if (
    (slot.kind !== 'ready' && slot.kind !== 'empty') ||
    slot.freshness !== 'live' ||
    !slot.token
  ) {
    return undefined;
  }
  return {
    sourceId,
    sourceKeyIdentity: getHomeSourceKeyIdentity(slot.token.sourceKey),
    dataSchemaVersion: slot.token.sourceKey.dataSchemaVersion,
    coverageFingerprint: slot.coverageFingerprint,
    quoteBasis: slot.token.sourceKey.quoteBasis ?? null,
    confirmedAt: now,
    expiresAt: now + HOME_STORE_CACHE_TTL_MS,
    payload:
      slot.kind === 'ready' && slot.data
        ? slot.data
        : { section: { kind: 'empty' } },
  };
}

export { HOME_STORE_CACHE_TTL_MS, createCacheRecord };
