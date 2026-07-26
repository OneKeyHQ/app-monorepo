import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import type { IFirmwareManifestChannel } from '../../../services/ServiceFirmwareUpdate/firmwareUpdateCoordinatorTypes';

const CACHE_VERSION = 1;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type IFirmwareManifestCacheScope = {
  catalogLineage: string;
  channel: IFirmwareManifestChannel;
};

export type IFirmwareManifestCacheRecord = IFirmwareManifestCacheScope & {
  key: string;
  catalogEpoch: number;
  projectionDigest: string;
  sourceSelectionDigest: string;
  snapshotDigest: string;
  snapshotJson: string;
  acceptedAt: number;
};

export type IFirmwareManifestRollbackAnchor = {
  catalogEpoch: number;
  acceptedAt: number;
};

export type ISimpleDbFirmwareManifestCacheData = {
  version: typeof CACHE_VERSION;
  highestAcceptedByScope: Record<string, IFirmwareManifestRollbackAnchor>;
  lastGoodByKey: Record<string, IFirmwareManifestCacheRecord>;
};

const createEmptyData = (): ISimpleDbFirmwareManifestCacheData => ({
  version: CACHE_VERSION,
  highestAcceptedByScope: {},
  lastGoodByKey: {},
});

const getScopeKey = ({
  catalogLineage,
  channel,
}: IFirmwareManifestCacheScope) => `${catalogLineage}\u0000${channel}`;

const assertCatalogEpoch = (catalogEpoch: number) => {
  if (!Number.isSafeInteger(catalogEpoch) || catalogEpoch <= 0) {
    throw new OneKeyLocalError(
      'Firmware manifest catalog epoch must be a positive safe integer',
    );
  }
};

const assertRecord = (record: IFirmwareManifestCacheRecord) => {
  assertCatalogEpoch(record.catalogEpoch);
  if (
    !record.key ||
    !record.catalogLineage ||
    !record.snapshotJson ||
    !SHA256_PATTERN.test(record.projectionDigest) ||
    !SHA256_PATTERN.test(record.sourceSelectionDigest) ||
    !SHA256_PATTERN.test(record.snapshotDigest)
  ) {
    throw new OneKeyLocalError('Firmware manifest cache record is invalid');
  }
};

export class SimpleDbEntityFirmwareManifestCache extends SimpleDbEntityBase<ISimpleDbFirmwareManifestCacheData> {
  entityName = 'firmwareManifestCache';

  override enableCache = false;

  async observeCatalogEpoch({
    catalogLineage,
    channel,
    catalogEpoch,
    acceptedAt = Date.now(),
  }: IFirmwareManifestCacheScope & {
    catalogEpoch: number;
    acceptedAt?: number;
  }): Promise<'accepted' | 'catalog_downgrade'> {
    assertCatalogEpoch(catalogEpoch);
    const scopeKey = getScopeKey({ catalogLineage, channel });
    let result: 'accepted' | 'catalog_downgrade' = 'accepted';
    await this.setRawData((rawData) => {
      const data = rawData ?? createEmptyData();
      const current = data.highestAcceptedByScope[scopeKey];
      if (current && current.catalogEpoch > catalogEpoch) {
        result = 'catalog_downgrade';
        return data;
      }
      if (current?.catalogEpoch === catalogEpoch) {
        return data;
      }
      return {
        ...data,
        version: CACHE_VERSION,
        highestAcceptedByScope: {
          ...data.highestAcceptedByScope,
          [scopeKey]: {
            catalogEpoch,
            acceptedAt,
          },
        },
      };
    });
    return result;
  }

  async getHighestAccepted(
    scope: IFirmwareManifestCacheScope,
  ): Promise<IFirmwareManifestRollbackAnchor | undefined> {
    const data = await this.getRawData();
    return data?.highestAcceptedByScope[getScopeKey(scope)];
  }

  async getLastGood(
    key: string,
  ): Promise<IFirmwareManifestCacheRecord | undefined> {
    const data = await this.getRawData();
    return data?.lastGoodByKey[key];
  }

  async saveLastGood(record: IFirmwareManifestCacheRecord): Promise<void> {
    assertRecord(record);
    const scopeKey = getScopeKey(record);
    await this.setRawData((rawData) => {
      const data = rawData ?? createEmptyData();
      const current = data.highestAcceptedByScope[scopeKey];
      if (current && current.catalogEpoch > record.catalogEpoch) {
        throw new OneKeyLocalError(
          'Firmware manifest cache rejected a catalog epoch regression',
        );
      }
      return {
        ...data,
        version: CACHE_VERSION,
        highestAcceptedByScope: {
          ...data.highestAcceptedByScope,
          [scopeKey]: {
            catalogEpoch: record.catalogEpoch,
            acceptedAt: Math.max(current?.acceptedAt ?? 0, record.acceptedAt),
          },
        },
        lastGoodByKey: {
          ...data.lastGoodByKey,
          [record.key]: record,
        },
      };
    });
  }

  async clearLastGoodPreservingRollbackAnchors(): Promise<void> {
    await this.setRawData((rawData) => ({
      ...(rawData ?? createEmptyData()),
      version: CACHE_VERSION,
      lastGoodByKey: {},
    }));
  }
}

export const firmwareManifestCache = new SimpleDbEntityFirmwareManifestCache();
