import type {
  IHomeRuntimeJsonValue,
  IHomeRuntimeRequestToken,
} from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { getHomeSourceKeyIdentity } from '../core/homeIdentity';
import { buildHomeBannerCoverageFingerprint } from '../sections/banner/homeBannerStoreModel';

import type { IHomeCachedSourceRecord } from './homeStoreTypes';

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
  return (
    rowIds.every((rowId) => typeof rowId === 'string') &&
    record.coverageFingerprint === stringUtils.stableStringify(rowIds)
  );
}

export function isHomeCachedRecordExactForToken(
  record: IHomeCachedSourceRecord,
  token: IHomeRuntimeRequestToken,
): boolean {
  return (
    record.sourceId === token.sourceKey.sourceId &&
    record.sourceKeyIdentity === getHomeSourceKeyIdentity(token.sourceKey) &&
    record.dataSchemaVersion === token.sourceKey.dataSchemaVersion &&
    stringUtils.stableStringify(record.quoteBasis) ===
      stringUtils.stableStringify(token.sourceKey.quoteBasis ?? null) &&
    hasConsistentSectionCoverage(record)
  );
}
