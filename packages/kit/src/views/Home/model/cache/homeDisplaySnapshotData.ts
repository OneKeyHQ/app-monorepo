import type { IHomeRuntimeJsonValue } from '@onekeyhq/shared/src/types/homeRuntime';

import {
  HOME_BANNER_SNAPSHOT_KEYS,
  createHomeBannerSnapshotDefaults,
} from '../sections/banner/homeBannerStoreModel';
import {
  HOME_DEFI_SNAPSHOT_KEYS,
  createHomeDeFiSnapshotDefaults,
} from '../sections/defi/homeDeFiSourceAdapter';
import {
  HOME_HISTORY_SNAPSHOT_KEYS,
  createHomeHistorySnapshotDefaults,
} from '../sections/history/homeHistorySourceAdapter';
import {
  HOME_NFT_SNAPSHOT_KEYS,
  createHomeNFTSnapshotDefaults,
} from '../sections/nft/homeNFTSourceAdapter';
import {
  HOME_PERPS_SNAPSHOT_KEYS,
  createHomePerpsSnapshotDefaults,
} from '../sections/perps/homePerpsSourceAdapter';
import {
  HOME_SPOT_SNAPSHOT_KEYS,
  createHomeSpotSnapshotDefaults,
} from '../sections/spot/homeSpotSourceAdapter';

import type { IHomeBannerStorePayload } from '../sections/banner/homeBannerStoreModel';
import type { IHomeDeFiLegacyPayload } from '../sections/defi/homeDeFiSourceAdapter';
import type { IHomeHistoryStorePayload } from '../sections/history/homeHistorySourceAdapter';
import type { IHomeNFTLegacyPayload } from '../sections/nft/homeNFTSourceAdapter';
import type { IHomePerpsLegacyPayload } from '../sections/perps/homePerpsSourceAdapter';
import type { IHomeSpotLegacyPayload } from '../sections/spot/homeSpotSourceAdapter';
import type {
  IHomeCachedSourceRecord,
  IHomeStoreSourceId,
} from '../store/homeStoreTypes';

type IJsonObject = Record<string, unknown>;

function isObject(value: unknown): value is IJsonObject {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function pickSnapshotFields<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[],
): Partial<Pick<T, K>> {
  const result: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const fieldValue = value[key];
    if (fieldValue !== undefined) {
      result[key] = fieldValue;
    }
  }
  return result;
}

function restoreSnapshotFields<T extends object>({
  createDefaults,
  persisted,
}: {
  createDefaults: () => T;
  persisted: unknown;
}): T {
  return {
    ...createDefaults(),
    ...(isObject(persisted) ? persisted : {}),
  };
}

function projectSourceData({
  sourceId,
  value,
}: {
  sourceId: IHomeStoreSourceId;
  value: unknown;
}): IHomeRuntimeJsonValue | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  switch (sourceId) {
    case 'banner':
      return pickSnapshotFields(
        value as IHomeBannerStorePayload,
        HOME_BANNER_SNAPSHOT_KEYS,
      ) as IHomeRuntimeJsonValue;
    case 'portfolio':
      return pickSnapshotFields(
        value as IHomeSpotLegacyPayload,
        HOME_SPOT_SNAPSHOT_KEYS,
      ) as IHomeRuntimeJsonValue;
    case 'perps':
      return pickSnapshotFields(
        value as IHomePerpsLegacyPayload,
        HOME_PERPS_SNAPSHOT_KEYS,
      ) as IHomeRuntimeJsonValue;
    case 'defi':
      return pickSnapshotFields(
        value as IHomeDeFiLegacyPayload,
        HOME_DEFI_SNAPSHOT_KEYS,
      ) as IHomeRuntimeJsonValue;
    case 'nft':
      return pickSnapshotFields(
        value as IHomeNFTLegacyPayload,
        HOME_NFT_SNAPSHOT_KEYS,
      ) as IHomeRuntimeJsonValue;
    case 'history':
      return pickSnapshotFields(
        value as IHomeHistoryStorePayload,
        HOME_HISTORY_SNAPSHOT_KEYS,
      ) as IHomeRuntimeJsonValue;
    case 'capability':
    case 'market':
      return undefined;
    default:
      return sourceId satisfies never;
  }
}

function restoreSourceData({
  sourceId,
  value,
}: {
  sourceId: IHomeStoreSourceId;
  value: unknown;
}): IHomeRuntimeJsonValue | undefined {
  switch (sourceId) {
    case 'banner':
      return restoreSnapshotFields({
        createDefaults: createHomeBannerSnapshotDefaults,
        persisted: value,
      }) as IHomeRuntimeJsonValue;
    case 'portfolio':
      return restoreSnapshotFields({
        createDefaults: createHomeSpotSnapshotDefaults,
        persisted: value,
      }) as unknown as IHomeRuntimeJsonValue;
    case 'perps':
      return restoreSnapshotFields({
        createDefaults: createHomePerpsSnapshotDefaults,
        persisted: value,
      }) as unknown as IHomeRuntimeJsonValue;
    case 'defi':
      return restoreSnapshotFields({
        createDefaults: createHomeDeFiSnapshotDefaults,
        persisted: value,
      }) as IHomeRuntimeJsonValue;
    case 'nft':
      return restoreSnapshotFields({
        createDefaults: createHomeNFTSnapshotDefaults,
        persisted: value,
      }) as IHomeRuntimeJsonValue;
    case 'history':
      return restoreSnapshotFields({
        createDefaults: createHomeHistorySnapshotDefaults,
        persisted: value,
      }) as unknown as IHomeRuntimeJsonValue;
    case 'capability':
    case 'market':
      return undefined;
    default:
      return sourceId satisfies never;
  }
}

function getPersistedSection(
  value: unknown,
):
  | { kind: 'empty' }
  | { kind: 'ready'; rowIds: readonly string[]; payload: unknown }
  | undefined {
  if (!isObject(value) || !isObject(value.section)) {
    return undefined;
  }
  if (value.section.kind === 'empty') {
    return { kind: 'empty' };
  }
  if (
    value.section.kind !== 'ready' ||
    !Array.isArray(value.section.rowIds) ||
    !value.section.rowIds.every((rowId) => typeof rowId === 'string')
  ) {
    return undefined;
  }
  return {
    kind: 'ready',
    rowIds: value.section.rowIds,
    payload: value.payload,
  };
}

function projectHomeDisplaySnapshotRecord(
  record: IHomeCachedSourceRecord,
): IHomeCachedSourceRecord | undefined {
  if (record.sourceId === 'capability' || record.sourceId === 'market') {
    return undefined;
  }
  if (record.sourceId === 'banner') {
    const bannerPayload = record.payload as IHomeBannerStorePayload;
    const payload = projectSourceData({
      sourceId: record.sourceId,
      value: bannerPayload,
    });
    return payload ? { ...record, payload } : undefined;
  }
  const section = getPersistedSection(record.payload);
  if (!section) {
    return undefined;
  }
  if (section.kind === 'empty') {
    return {
      ...record,
      payload: { section: { kind: 'empty' } },
    };
  }
  const payload = projectSourceData({
    sourceId: record.sourceId,
    value: section.payload,
  });
  if (!payload) {
    return undefined;
  }
  return {
    ...record,
    payload: {
      payload,
      section: {
        kind: 'ready',
        rowIds: section.rowIds,
      },
    },
  };
}

function restoreHomeDisplaySnapshotRecord(
  record: IHomeCachedSourceRecord,
): IHomeCachedSourceRecord | undefined {
  if (record.sourceId === 'capability' || record.sourceId === 'market') {
    return undefined;
  }
  if (record.sourceId === 'banner') {
    const payload = restoreSourceData({
      sourceId: record.sourceId,
      value: record.payload,
    });
    return payload ? { ...record, payload } : undefined;
  }
  const section = getPersistedSection(record.payload);
  if (!section) {
    return undefined;
  }
  if (section.kind === 'empty') {
    return {
      ...record,
      payload: { section: { kind: 'empty' } },
    };
  }
  const payload = restoreSourceData({
    sourceId: record.sourceId,
    value: section.payload,
  });
  if (!payload) {
    return undefined;
  }
  return {
    ...record,
    payload: {
      payload,
      section: {
        kind: 'ready',
        rowIds: section.rowIds,
      },
    },
  };
}

export {
  pickSnapshotFields,
  projectHomeDisplaySnapshotRecord,
  restoreHomeDisplaySnapshotRecord,
};
