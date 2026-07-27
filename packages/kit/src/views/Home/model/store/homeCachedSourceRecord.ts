import type {
  IHomeRuntimeJsonValue,
  IHomeRuntimeRequestToken,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { getHomeSourceKeyIdentity } from '../core/homeIdentity';
import { buildHomeBannerCoverageFingerprint } from '../sections/banner/homeBannerStoreModel';

import type {
  IHomeCachedSourceRecord,
  IHomeStoreResourceSlot,
  IHomeStoreSourceId,
} from './homeStoreTypes';

const HOME_STORE_RECORD_TTL_MS = 5 * 60 * 1000;

function createHomeCachedSourceRecord({
  now,
  slot,
  sourceId,
  ttlMs = HOME_STORE_RECORD_TTL_MS,
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

function hasConsistentSectionCoverage(
  record: IHomeCachedSourceRecord,
): boolean {
  if (
    !record.payload ||
    typeof record.payload !== 'object' ||
    Array.isArray(record.payload)
  ) {
    return false;
  }
  const payload = record.payload as {
    readonly [key: string]: IHomeRuntimeJsonValue;
  };
  if (record.sourceId === 'capability') {
    return false;
  }
  if (record.sourceId === 'banner') {
    if (!Array.isArray(payload.banners)) {
      return false;
    }
    const bannerIds = payload.banners.map((banner) => {
      if (!banner || typeof banner !== 'object' || Array.isArray(banner)) {
        return undefined;
      }
      return (banner as { readonly id?: IHomeRuntimeJsonValue }).id;
    });
    return (
      bannerIds.every((bannerId) => typeof bannerId === 'string') &&
      record.coverageFingerprint ===
        buildHomeBannerCoverageFingerprint({
          bannerIds: bannerIds as string[],
          hasTronResource: Boolean(payload.tronResource),
        })
    );
  }
  const section = payload.section;
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return false;
  }
  const sectionObject = section as {
    readonly [key: string]: IHomeRuntimeJsonValue;
  };
  if (sectionObject.kind === 'empty') {
    return record.coverageFingerprint === `${record.sourceId}:empty`;
  }
  if (sectionObject.kind !== 'ready' || !Array.isArray(sectionObject.rowIds)) {
    return false;
  }
  const rowIds = sectionObject.rowIds;
  if (!rowIds.every((rowId) => typeof rowId === 'string')) {
    return false;
  }
  return (
    record.coverageFingerprint ===
    [rowIds.length, rowIds[0] ?? '', rowIds[rowIds.length - 1] ?? ''].join(':')
  );
}

function isHomeCachedRecordExactForToken(
  record: IHomeCachedSourceRecord,
  token: IHomeRuntimeRequestToken,
): boolean {
  const tokenQuoteBasis = token.sourceKey.quoteBasis ?? null;
  return (
    record.sourceId === token.sourceKey.sourceId &&
    record.sourceKeyIdentity === getHomeSourceKeyIdentity(token.sourceKey) &&
    record.dataSchemaVersion === token.sourceKey.dataSchemaVersion &&
    record.quoteBasis?.currency === tokenQuoteBasis?.currency &&
    record.quoteBasis?.pricingRevision === tokenQuoteBasis?.pricingRevision &&
    hasConsistentSectionCoverage(record)
  );
}

export { createHomeCachedSourceRecord, isHomeCachedRecordExactForToken };
