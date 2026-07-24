import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getHomeSourceKeyIdentity } from '../core/homeIdentity';

import type {
  IHomeCachedSnapshotPayload,
  IHomeCachedSourceRecord,
  IHomeStoreResourceSlot,
  IHomeStoreSourceId,
} from './homeStoreTypes';

const HOME_STORE_CACHE_TTL_MS = 5 * 60 * 1000;

function getHomeStoreCacheContentSignature({
  records,
}: Pick<IHomeCachedSnapshotPayload, 'records'>): string {
  return stringUtils.stableStringify({
    records: records.map(
      ({ confirmedAt: _confirmedAt, expiresAt: _expiresAt, ...record }) =>
        record,
    ),
  });
}

function createCacheRecord({
  now,
  slot,
  sourceId,
  ttlMs = HOME_STORE_CACHE_TTL_MS,
}: {
  now: number;
  slot: IHomeStoreResourceSlot<IHomeRuntimeJsonValue>;
  sourceId: IHomeStoreSourceId;
  ttlMs?: number;
}): IHomeCachedSourceRecord | undefined {
  if (
    (slot.kind !== 'ready' && slot.kind !== 'empty') ||
    slot.freshness !== 'live' ||
    slot.refresh !== 'idle' ||
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
    expiresAt: now + ttlMs,
    payload:
      slot.kind === 'ready' && slot.data
        ? slot.data
        : { section: { kind: 'empty' } },
  };
}

function mergeHomeStoreCacheRecords({
  cachedRecords,
  liveRecords,
  now,
}: {
  cachedRecords: readonly IHomeCachedSourceRecord[];
  liveRecords: readonly IHomeCachedSourceRecord[];
  now: number;
}): IHomeCachedSourceRecord[] {
  const recordsBySource = new Map(
    cachedRecords
      .filter((record) => record.expiresAt > now)
      .map((record) => [record.sourceId, record]),
  );
  liveRecords.forEach((record) => {
    recordsBySource.set(record.sourceId, record);
  });
  return Array.from(recordsBySource.values());
}

export {
  HOME_STORE_CACHE_TTL_MS,
  createCacheRecord,
  getHomeStoreCacheContentSignature,
  mergeHomeStoreCacheRecords,
};
