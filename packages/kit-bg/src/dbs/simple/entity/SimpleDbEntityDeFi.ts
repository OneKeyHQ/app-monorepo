import { isEqual, isFunction, omit } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';
import {
  createSimpleDbSnapshotCache,
  decodeSnapshotSubKey,
  encodeSnapshotSubKey,
  ensureSimpleDbSnapshotNamespaceReady,
  isEntityMethodMocked,
  isSimpleDbSnapshotPersistenceAllowed,
} from '../base/simpleDbSnapshotCacheUtils';

export type IDeFiAccountOverviewMap = Record<
  string,
  {
    totalValue: number;
    totalDebt: number;
    totalReward: number;
    netWorth: number;
    currency: string;
  }
>;

export interface IDeFiDBStruct {
  enabledNetworksMap?: Record<string, boolean>; // <networkId, enabled>
  manualForceRefreshQuota?: {
    dayKey: string;
    count: number;
    lastForcedAt: number;
  };
  overview?: Record<string, IDeFiAccountOverviewMap>; // <accountAddress/xpub, <networkId, overview>>
}

const DEFI_SNAPSHOT_NAMESPACE = 'sdb-defi' as const;
const DEFI_OVERVIEW_PREFIX = 'overview:';
const DEFI_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const DEFI_MAX_ENTRIES = 256;
const DEFI_MAX_RECORD_BYTES = 512 * 1024;

const DEFAULT_APP_STORAGE =
  storageHub.$webStorageSimpleDB || storageHub.appStorage;

const defiSnapshotCache = createSimpleDbSnapshotCache<IDeFiAccountOverviewMap>({
  namespace: DEFI_SNAPSHOT_NAMESPACE,
  maxAgeMs: DEFI_MAX_AGE_MS,
  maxEntries: DEFI_MAX_ENTRIES,
  maxRecordBytes: DEFI_MAX_RECORD_BYTES,
});

export class SimpleDbEntityDeFi extends SimpleDbEntityBase<IDeFiDBStruct> {
  entityName = 'deFi';

  override enableCache = false;

  protected override readonly enableReferenceEqualityWriteSkip = true;

  private usesNativeSnapshotCache(): boolean {
    return (
      platformEnv.isNative === true && this.appStorage === DEFAULT_APP_STORAGE
    );
  }

  private canUseDirectShardedAccess(): boolean {
    return (
      this.usesNativeSnapshotCache() &&
      !isEntityMethodMocked(this, 'getRawData') &&
      !isEntityMethodMocked(this, 'setRawData') &&
      !isEntityMethodMocked(this, 'setRawDataWithCommitGuard')
    );
  }

  private readAllShardedOverview(): Record<string, IDeFiAccountOverviewMap> {
    const result: Record<string, IDeFiAccountOverviewMap> = {};
    defiSnapshotCache.keys().forEach((encodedKey) => {
      const rawKey = decodeSnapshotSubKey(DEFI_OVERVIEW_PREFIX, encodedKey);
      if (rawKey === undefined) {
        return;
      }
      const entry = defiSnapshotCache.get(encodedKey)?.data;
      if (entry) {
        result[rawKey] = entry;
      }
    });
    return result;
  }

  @backgroundMethod()
  override async getRawData(): Promise<IDeFiDBStruct | undefined | null> {
    const persistent = await super.getRawData();
    if (!this.canUseDirectShardedAccess()) {
      return persistent;
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return persistent;
    }
    await ensureSimpleDbSnapshotNamespaceReady(DEFI_SNAPSHOT_NAMESPACE);
    const shardedOverview = this.readAllShardedOverview();
    const hasShardedOverview = Object.keys(shardedOverview).length > 0;
    if (!persistent && !hasShardedOverview) {
      return persistent;
    }
    return {
      ...(persistent ? omit(persistent, ['overview']) : {}),
      ...(hasShardedOverview ? { overview: shardedOverview } : {}),
    };
  }

  protected override async setRawDataWithCommitGuard(
    dataOrBuilder:
      | IDeFiDBStruct
      | ((rawData: IDeFiDBStruct | null | undefined) => IDeFiDBStruct)
      | ((rawData: IDeFiDBStruct | null | undefined) => Promise<IDeFiDBStruct>),
    assertCanCommit?: () => void,
    onCommitted?: (data: IDeFiDBStruct) => void,
  ): Promise<IDeFiDBStruct | undefined> {
    if (!this.canUseDirectShardedAccess()) {
      return super.setRawDataWithCommitGuard(
        dataOrBuilder,
        assertCanCommit,
        onCommitted,
      );
    }
    // Strip `overview` before writing persistent fields to `onekey-app-storage-v1`
    // so historical large overview payloads are naturally pruned on preference/quota writes.
    return super.setRawDataWithCommitGuard(
      async (rawData) => {
        const hadSplitResidue = Boolean(rawData && 'overview' in rawData);
        const strippedRawData = rawData
          ? (omit(rawData, ['overview']) as IDeFiDBStruct)
          : rawData;
        const built = isFunction(dataOrBuilder)
          ? await dataOrBuilder(strippedRawData)
          : dataOrBuilder;
        if (
          !hadSplitResidue &&
          strippedRawData !== null &&
          strippedRawData !== undefined &&
          rawData !== null &&
          rawData !== undefined &&
          Object.is(built, strippedRawData)
        ) {
          return rawData;
        }
        return omit(built, ['overview']) as IDeFiDBStruct;
      },
      assertCanCommit,
      onCommitted,
    );
  }

  @backgroundMethod()
  override async clearRawData(): Promise<void> {
    if (
      this.usesNativeSnapshotCache() &&
      (await isSimpleDbSnapshotPersistenceAllowed())
    ) {
      await ensureSimpleDbSnapshotNamespaceReady(DEFI_SNAPSHOT_NAMESPACE);
      defiSnapshotCache.clear();
    }
    await super.clearRawData();
  }

  @backgroundMethod()
  async updateEnabledNetworksMap({
    merge,
    enabledNetworksMap = {},
  }: {
    merge?: boolean;
    enabledNetworksMap?: Record<string, boolean>;
  }) {
    await this.setRawData((rawData) => {
      const originalEnabledNetworksMap = rawData?.enabledNetworksMap ?? {};
      const finalEnabledNetworksMap = merge
        ? {
            ...originalEnabledNetworksMap,
            ...enabledNetworksMap,
          }
        : enabledNetworksMap;
      if (
        rawData &&
        isEqual(originalEnabledNetworksMap, finalEnabledNetworksMap)
      ) {
        return rawData;
      }
      return { ...rawData, enabledNetworksMap: finalEnabledNetworksMap };
    });
  }

  @backgroundMethod()
  async getEnabledNetworksMap(): Promise<Record<string, boolean>> {
    const rawData = await super.getRawData();
    return rawData?.enabledNetworksMap ?? {};
  }

  @backgroundMethod()
  async consumeManualForceRefreshQuota({
    dayKey,
    now,
    dailyLimit,
    minIntervalMs,
  }: {
    dayKey: string;
    now: number;
    dailyLimit: number;
    minIntervalMs: number;
  }): Promise<{
    allowed: boolean;
    reason?: 'daily-limit' | 'interval';
    count: number;
    lastForcedAt: number;
    dailyLimit: number;
    minIntervalMs: number;
  }> {
    let result: {
      allowed: boolean;
      reason?: 'daily-limit' | 'interval';
      count: number;
      lastForcedAt: number;
      dailyLimit: number;
      minIntervalMs: number;
    } = {
      allowed: false,
      count: 0,
      lastForcedAt: 0,
      dailyLimit,
      minIntervalMs,
    };

    await this.setRawData((rawData) => {
      const current = rawData?.manualForceRefreshQuota;
      const normalized =
        current?.dayKey === dayKey
          ? current
          : {
              dayKey,
              count: 0,
              lastForcedAt: 0,
            };

      if (
        normalized.lastForcedAt > 0 &&
        now - normalized.lastForcedAt < minIntervalMs
      ) {
        result = {
          allowed: false,
          reason: 'interval',
          count: normalized.count,
          lastForcedAt: normalized.lastForcedAt,
          dailyLimit,
          minIntervalMs,
        };
        if (rawData && current === normalized) {
          return rawData;
        }
        return {
          ...rawData,
          manualForceRefreshQuota: normalized,
        };
      }

      if (normalized.count >= dailyLimit) {
        result = {
          allowed: false,
          reason: 'daily-limit',
          count: normalized.count,
          lastForcedAt: normalized.lastForcedAt,
          dailyLimit,
          minIntervalMs,
        };
        if (rawData && current === normalized) {
          return rawData;
        }
        return {
          ...rawData,
          manualForceRefreshQuota: normalized,
        };
      }

      const nextQuota = {
        dayKey,
        count: normalized.count + 1,
        lastForcedAt: now,
      };
      result = {
        allowed: true,
        count: nextQuota.count,
        lastForcedAt: nextQuota.lastForcedAt,
        dailyLimit,
        minIntervalMs,
      };
      return {
        ...rawData,
        manualForceRefreshQuota: nextQuota,
      };
    });

    return result;
  }

  @backgroundMethod()
  async updateAccountDeFiOverview({
    accountAddress,
    xpub,
    overview,
    merge,
  }: {
    accountAddress?: string;
    xpub?: string;
    overview: IDeFiAccountOverviewMap;
    merge?: boolean;
  }) {
    const key = accountUtils.buildAccountLocalAssetsKey({
      accountAddress,
      xpub,
    });

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(DEFI_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        const encodedKey = encodeSnapshotSubKey(DEFI_OVERVIEW_PREFIX, key);
        const originalOverview = defiSnapshotCache.get(encodedKey)?.data ?? {};
        const nextOverview = merge
          ? { ...originalOverview, ...overview }
          : overview;
        defiSnapshotCache.set(encodedKey, nextOverview);
      });
      return;
    }

    await this.setRawData((rawData) => {
      const data = rawData?.overview ?? {};
      const originalOverview = data[key] ?? {};
      if (originalOverview && merge) {
        return {
          ...rawData,
          overview: { ...data, [key]: { ...originalOverview, ...overview } },
        };
      }
      return { ...rawData, overview: { ...data, [key]: overview } };
    });
  }

  @backgroundMethod()
  async getAccountsDeFiOverview({
    accounts,
    deFiRawData,
  }: {
    accounts: {
      accountAddress?: string;
      xpub?: string;
    }[];
    deFiRawData?: IDeFiDBStruct;
  }) {
    if (!deFiRawData && this.canUseDirectShardedAccess()) {
      const allowed = await isSimpleDbSnapshotPersistenceAllowed();
      if (allowed) {
        await ensureSimpleDbSnapshotNamespaceReady(DEFI_SNAPSHOT_NAMESPACE);
      }
      return accounts.map(({ accountAddress, xpub }) => {
        if (!accountAddress && !xpub) {
          return undefined;
        }
        const key = accountUtils.buildAccountLocalAssetsKey({
          accountAddress,
          xpub,
        });
        const overview = allowed
          ? defiSnapshotCache.get(
              encodeSnapshotSubKey(DEFI_OVERVIEW_PREFIX, key),
            )?.data
          : undefined;
        if (!overview) {
          return undefined;
        }
        return {
          accountAddress,
          xpub,
          overview,
        };
      });
    }

    const rawData = deFiRawData ?? (await this.getRawData());
    return accounts.map(({ accountAddress, xpub }) => {
      if (!accountAddress && !xpub) {
        return undefined;
      }

      const key = accountUtils.buildAccountLocalAssetsKey({
        accountAddress,
        xpub,
      });

      if (!rawData?.overview?.[key]) {
        return undefined;
      }

      return {
        accountAddress,
        xpub,
        overview: rawData?.overview?.[key],
      };
    });
  }

  // Drop cached DeFi overviews belonging to deleted accounts. `overview` keys are
  // bare addresses/xpubs (no networkId prefix). `validOwners` is the set of
  // lowercased addresses/xpubs of all surviving accounts. Pure-cache cleanup.
  // See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(DEFI_SNAPSHOT_NAMESPACE);
      const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
      await this.mutex.runExclusive(async () => {
        defiSnapshotCache.keys().forEach((encodedKey) => {
          const rawKey = decodeSnapshotSubKey(DEFI_OVERVIEW_PREFIX, encodedKey);
          if (
            rawKey &&
            !accountUtils.isLocalAssetsKeyOwnedBy({
              key: rawKey,
              validOwners: validOwnerSet,
            })
          ) {
            defiSnapshotCache.remove(encodedKey);
          }
        });
      });
      return;
    }

    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot, so
      // a concurrent clearRawData is never undone by an `existing` fallback.
      const base = rawData;
      const overview = base?.overview ?? {};
      const nextOverview: NonNullable<IDeFiDBStruct['overview']> = {};
      for (const [key, value] of Object.entries(overview)) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextOverview[key] = value;
        }
      }
      return {
        ...base,
        overview: nextOverview,
      };
    });
  }
}
