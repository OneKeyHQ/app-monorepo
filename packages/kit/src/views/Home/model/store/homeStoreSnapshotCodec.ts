import {
  type IHomeRuntimeJsonValue,
  type IHomeRuntimeQuoteBasis,
  type IHomeRuntimeRequestToken,
  isHomeRuntimeJsonValue,
} from '@onekeyhq/shared/src/types/homeRuntime';
import {
  HOME_STORE_CACHE_ENVELOPE_SCHEMA_VERSION,
  type IHomeOpaqueCacheEnvelope,
  isHomeOpaqueCacheEnvelope,
} from '@onekeyhq/shared/src/types/homeStoreCache';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getHomeSourceKeyIdentity } from '../core/homeIdentity';
import { buildHomeBannerCoverageFingerprint } from '../sections/banner/homeBannerStoreModel';

import { HOME_STORE_SOURCE_IDS } from './homeStoreTypes';

import type {
  IHomeCachedSnapshotPayload,
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from './homeStoreTypes';

export const HOME_STORE_CACHE_CODEC_VERSION = 2 as const;
export const HOME_STORE_CACHE_MAX_RECORDS = 8;
export const HOME_STORE_CACHE_MAX_ROWS = 2000;
export const HOME_STORE_CACHE_MAX_BYTES = 2 * 1024 * 1024;

const forbiddenPayloadKeys = new Set([
  'privateKey',
  'secretKey',
  'mnemonic',
  'seed',
  'seedPhrase',
  'rawSignature',
  'signedPayload',
]);

function hasForbiddenPayloadKey(value: IHomeRuntimeJsonValue): boolean {
  if (Array.isArray(value)) {
    return value.some(hasForbiddenPayloadKey);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }
  return Object.entries(value).some(
    ([key, child]) =>
      forbiddenPayloadKeys.has(key) || hasForbiddenPayloadKey(child),
  );
}

function countRows(value: IHomeRuntimeJsonValue): number {
  if (Array.isArray(value)) {
    const children = value as readonly IHomeRuntimeJsonValue[];
    return (
      children.length +
      children.reduce<number>((sum, child) => sum + countRows(child), 0)
    );
  }
  if (!value || typeof value !== 'object') {
    return 0;
  }
  return Object.values(value).reduce<number>(
    (sum, child) => sum + countRows(child),
    0,
  );
}

function isHomeStoreSourceId(value: unknown): value is IHomeStoreSourceId {
  return HOME_STORE_SOURCE_IDS.some((sourceId) => sourceId === value);
}

function isQuoteBasis(value: unknown): value is IHomeRuntimeQuoteBasis | null {
  if (value === null) {
    return true;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const quoteBasis = value as Partial<IHomeRuntimeQuoteBasis>;
  return (
    typeof quoteBasis.currency === 'string' &&
    quoteBasis.currency.length > 0 &&
    (quoteBasis.pricingRevision === undefined ||
      typeof quoteBasis.pricingRevision === 'string')
  );
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
  return record.coverageFingerprint === stringUtils.stableStringify(rowIds);
}

export function isHomeCachedRecordExactForToken(
  record: IHomeCachedSourceRecord,
  token: IHomeRuntimeRequestToken,
): boolean {
  const tokenQuoteBasis = token.sourceKey.quoteBasis ?? null;
  return (
    record.sourceId === token.sourceKey.sourceId &&
    record.sourceKeyIdentity === getHomeSourceKeyIdentity(token.sourceKey) &&
    record.dataSchemaVersion === token.sourceKey.dataSchemaVersion &&
    stringUtils.stableStringify(record.quoteBasis) ===
      stringUtils.stableStringify(tokenQuoteBasis) &&
    hasConsistentSectionCoverage(record)
  );
}

function parseRecord(
  value: unknown,
  now: number,
): IHomeCachedSourceRecord | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const record = value as Partial<IHomeCachedSourceRecord>;
  if (
    !isHomeStoreSourceId(record.sourceId) ||
    typeof record.sourceKeyIdentity !== 'string' ||
    !Number.isSafeInteger(record.dataSchemaVersion) ||
    Number(record.dataSchemaVersion) <= 0 ||
    typeof record.coverageFingerprint !== 'string' ||
    record.coverageFingerprint.length === 0 ||
    !isQuoteBasis(record.quoteBasis) ||
    !Number.isSafeInteger(record.confirmedAt) ||
    !Number.isSafeInteger(record.expiresAt) ||
    Number(record.expiresAt) <= now ||
    Number(record.confirmedAt) > Number(record.expiresAt) ||
    !isHomeRuntimeJsonValue(record.payload) ||
    hasForbiddenPayloadKey(record.payload) ||
    countRows(record.payload) > HOME_STORE_CACHE_MAX_ROWS
  ) {
    return undefined;
  }
  const parsed = record as IHomeCachedSourceRecord;
  return hasConsistentSectionCoverage(parsed) ? parsed : undefined;
}

export function encodeHomeStoreSnapshot({
  key,
  ownerScopeKey,
  records,
  createdAt,
  expiresAt,
}: {
  key: string;
  ownerScopeKey: string;
  records: readonly IHomeCachedSourceRecord[];
  createdAt: number;
  expiresAt: number;
}): IHomeOpaqueCacheEnvelope | undefined {
  if (
    !key ||
    !ownerScopeKey ||
    records.length > HOME_STORE_CACHE_MAX_RECORDS ||
    expiresAt <= createdAt ||
    records.some(
      (record) =>
        !parseRecord(record, createdAt) || record.expiresAt > expiresAt,
    )
  ) {
    return undefined;
  }
  const payload: IHomeCachedSnapshotPayload = {
    codecVersion: HOME_STORE_CACHE_CODEC_VERSION,
    ownerScopeKey,
    records,
  };
  const encodedPayload = stringUtils.stableStringify(payload);
  if (
    new TextEncoder().encode(encodedPayload).length > HOME_STORE_CACHE_MAX_BYTES
  ) {
    return undefined;
  }
  return {
    key,
    schemaVersion: HOME_STORE_CACHE_ENVELOPE_SCHEMA_VERSION,
    ownerScopeKey,
    createdAt,
    expiresAt,
    payload: encodedPayload,
  };
}

export function decodeHomeStoreSnapshot({
  envelope,
  expectedOwnerScopeKey,
  now,
}: {
  envelope: unknown;
  expectedOwnerScopeKey: string;
  now: number;
}): IHomeCachedSnapshotPayload | undefined {
  if (
    !isHomeOpaqueCacheEnvelope(envelope) ||
    envelope.ownerScopeKey !== expectedOwnerScopeKey ||
    envelope.expiresAt <= now ||
    new TextEncoder().encode(envelope.payload).length >
      HOME_STORE_CACHE_MAX_BYTES
  ) {
    return undefined;
  }
  try {
    const value = JSON.parse(
      envelope.payload,
    ) as Partial<IHomeCachedSnapshotPayload>;
    if (
      value.codecVersion !== HOME_STORE_CACHE_CODEC_VERSION ||
      value.ownerScopeKey !== expectedOwnerScopeKey ||
      !Array.isArray(value.records) ||
      value.records.length > HOME_STORE_CACHE_MAX_RECORDS ||
      new Set(
        value.records.map(
          (record) => (record as Partial<IHomeCachedSourceRecord>).sourceId,
        ),
      ).size !== value.records.length
    ) {
      return undefined;
    }
    const records = value.records
      .map((record) => parseRecord(record, now))
      .filter((record): record is IHomeCachedSourceRecord => Boolean(record));
    if (records.length !== value.records.length) {
      return undefined;
    }
    return {
      codecVersion: HOME_STORE_CACHE_CODEC_VERSION,
      ownerScopeKey: expectedOwnerScopeKey,
      records,
    };
  } catch {
    return undefined;
  }
}
