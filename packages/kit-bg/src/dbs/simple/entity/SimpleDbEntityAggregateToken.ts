import { isFunction, omit } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { buildLocalAggregateTokenMapKey } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  IAccountToken,
  IAggregateToken,
  IHomeDefaultToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';
import {
  createSimpleDbSnapshotCache,
  decodeSnapshotSubKey,
  encodeSnapshotSubKey,
  ensureSimpleDbSnapshotNamespaceReady,
  isEntityMethodMocked,
  isSimpleDbSnapshotPersistenceAllowed,
} from '../base/simpleDbSnapshotCacheUtils';

export type IAggregateTokenAccountListEntry = Record<
  string,
  {
    tokens: IAccountToken[];
  }
>;

export type IAggregateTokenAccountFiatEntry = Record<
  string,
  Record<string, ITokenFiat>
>;

export interface ISimpleDBAggregateToken {
  aggregateTokenConfigMap?: Record<string, IAggregateToken>;
  aggregateTokenSymbolMap?: Record<string, boolean>;
  homeDefaultTokenMap?: Record<string, IHomeDefaultToken>;
  aggregateTokenMap?: Record<string, Record<string, ITokenFiat>>;
  aggregateTokenMapV2?: Record<string, IAggregateTokenAccountFiatEntry>;
  aggregateTokenListMap?: Record<string, IAggregateTokenAccountListEntry>;
  allAggregateTokenMap?: Record<
    string,
    {
      tokens: IAccountToken[];
    }
  >;
  allAggregateTokens?: IAccountToken[];
  // Tracks the last successful wallet-config sync so stale caches written by
  // older builds (with a different preset network list) get refreshed. Hot
  // updates keep appVersion but change bundleVersion, so both are tracked.
  configSyncMeta?: {
    appVersion: string;
    // Absent on caches written before bundle tracking was added.
    bundleVersion?: string;
    syncedAt: number;
  };
  tokenDetails?: Record<
    string, // all networks accountId
    Record<
      string, // aggregate token id
      {
        lastActiveTabName: string;
      }
    >
  >;
}

const AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE = 'sdb-aggregate-token' as const;
const AGGREGATE_TOKEN_LIST_PREFIX = 'list:';
const AGGREGATE_TOKEN_MAP_PREFIX = 'map:';
const AGGREGATE_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const AGGREGATE_TOKEN_MAX_ENTRIES = 256;
const AGGREGATE_TOKEN_MAX_RECORD_BYTES = 2 * 1024 * 1024;
const SPLIT_AGGREGATE_CACHE_FIELDS = [
  'aggregateTokenMap',
  'aggregateTokenMapV2',
  'aggregateTokenListMap',
] as const;

const DEFAULT_APP_STORAGE =
  storageHub.$webStorageSimpleDB || storageHub.appStorage;

type IAggregateTokenSnapshotValue =
  | IAggregateTokenAccountListEntry
  | IAggregateTokenAccountFiatEntry;

const aggregateTokenSnapshotCache =
  createSimpleDbSnapshotCache<IAggregateTokenSnapshotValue>({
    namespace: AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE,
    maxAgeMs: AGGREGATE_TOKEN_MAX_AGE_MS,
    maxEntries: AGGREGATE_TOKEN_MAX_ENTRIES,
    maxRecordBytes: AGGREGATE_TOKEN_MAX_RECORD_BYTES,
  });

export class SimpleDbEntityAggregateToken extends SimpleDbEntityBase<ISimpleDBAggregateToken> {
  entityName = 'aggregateToken';

  override enableCache = false;

  protected override readonly enableReferenceEqualityWriteSkip = true;

  private isDefaultAppStorage(): boolean {
    return this.appStorage === DEFAULT_APP_STORAGE;
  }

  private canUseDirectShardedAccess(): boolean {
    return (
      this.isDefaultAppStorage() &&
      !isEntityMethodMocked(this, 'getRawData') &&
      !isEntityMethodMocked(this, 'setRawData') &&
      !isEntityMethodMocked(this, 'setRawDataWithCommitGuard')
    );
  }

  protected override async setRawDataWithCommitGuard(
    dataOrBuilder:
      | ISimpleDBAggregateToken
      | ((
          rawData: ISimpleDBAggregateToken | null | undefined,
        ) => ISimpleDBAggregateToken)
      | ((
          rawData: ISimpleDBAggregateToken | null | undefined,
        ) => Promise<ISimpleDBAggregateToken>),
    assertCanCommit?: () => void,
    onCommitted?: (data: ISimpleDBAggregateToken) => void,
  ): Promise<ISimpleDBAggregateToken | undefined> {
    if (!this.canUseDirectShardedAccess()) {
      return super.setRawDataWithCommitGuard(
        dataOrBuilder,
        assertCanCommit,
        onCommitted,
      );
    }
    return super.setRawDataWithCommitGuard(
      async (rawData) => {
        const hadSplitResidue = Boolean(
          rawData &&
          SPLIT_AGGREGATE_CACHE_FIELDS.some((field) => field in rawData),
        );
        const strippedRawData = rawData
          ? (omit(
              rawData,
              SPLIT_AGGREGATE_CACHE_FIELDS,
            ) as ISimpleDBAggregateToken)
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
        return omit(
          built,
          SPLIT_AGGREGATE_CACHE_FIELDS,
        ) as ISimpleDBAggregateToken;
      },
      assertCanCommit,
      onCommitted,
    );
  }

  @backgroundMethod()
  override async clearRawData(): Promise<void> {
    if (
      this.isDefaultAppStorage() &&
      (await isSimpleDbSnapshotPersistenceAllowed())
    ) {
      await ensureSimpleDbSnapshotNamespaceReady(
        AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE,
      );
      aggregateTokenSnapshotCache.clear();
    }
    await super.clearRawData();
  }

  @backgroundMethod()
  async getAggregateTokenConfigMap() {
    return (await this.getRawData())?.aggregateTokenConfigMap ?? {};
  }

  @backgroundMethod()
  async getAggregateTokenConfigSnapshot(): Promise<
    Pick<ISimpleDBAggregateToken, 'aggregateTokenConfigMap'>
  > {
    // Keep missing config distinct from a valid empty map for first-use sync.
    return {
      aggregateTokenConfigMap: (await this.getRawData())
        ?.aggregateTokenConfigMap,
    };
  }

  @backgroundMethod()
  async getHomeDefaultTokenMap() {
    return (await this.getRawData())?.homeDefaultTokenMap ?? {};
  }

  @backgroundMethod()
  async updateHomeDefaultTokenMap({
    homeDefaultTokenMap,
    merge = false,
  }: {
    homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
    merge?: boolean;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      homeDefaultTokenMap: merge
        ? { ...rawData?.homeDefaultTokenMap, ...homeDefaultTokenMap }
        : homeDefaultTokenMap,
    }));
  }

  @backgroundMethod()
  async getAggregateTokenMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return {};
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE,
      );
      return (
        (aggregateTokenSnapshotCache.get(
          encodeSnapshotSubKey(AGGREGATE_TOKEN_MAP_PREFIX, key),
        )?.data as IAggregateTokenAccountFiatEntry | undefined) ?? {}
      );
    }
    return (await this.getRawData())?.aggregateTokenMapV2?.[key] ?? {};
  }

  @backgroundMethod()
  async updateAggregateTokenMap({
    accountId,
    networkId,
    aggregateTokenMap,
  }: {
    accountId: string;
    networkId: string;
    aggregateTokenMap: Record<string, Record<string, ITokenFiat>>;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        aggregateTokenSnapshotCache.set(
          encodeSnapshotSubKey(AGGREGATE_TOKEN_MAP_PREFIX, key),
          aggregateTokenMap,
        );
      });
      return;
    }
    await this.setRawData((rawData) => {
      return {
        ...rawData,
        aggregateTokenMapV2: {
          ...rawData?.aggregateTokenMapV2,
          [key]: aggregateTokenMap,
        },
      };
    });
  }

  @backgroundMethod()
  async getAggregateTokenListMap({
    networkId,
    accountId,
  }: {
    networkId: string;
    accountId: string;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return {};
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE,
      );
      return (
        (aggregateTokenSnapshotCache.get(
          encodeSnapshotSubKey(AGGREGATE_TOKEN_LIST_PREFIX, key),
        )?.data as IAggregateTokenAccountListEntry | undefined) ?? {}
      );
    }
    return (await this.getRawData())?.aggregateTokenListMap?.[key] ?? {};
  }

  @backgroundMethod()
  async getAggregateTokenSymbolMap() {
    return (await this.getRawData())?.aggregateTokenSymbolMap ?? {};
  }

  @backgroundMethod()
  async updateAggregateTokenListMap({
    accountId,
    networkId,
    aggregateTokenListMap,
  }: {
    accountId: string;
    networkId: string;
    aggregateTokenListMap: Record<string, { tokens: IAccountToken[] }>;
  }) {
    const key = buildLocalAggregateTokenMapKey({
      networkId,
      accountId,
    });
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        const encodedKey = encodeSnapshotSubKey(
          AGGREGATE_TOKEN_LIST_PREFIX,
          key,
        );
        const existing =
          (aggregateTokenSnapshotCache.get(encodedKey)?.data as
            | IAggregateTokenAccountListEntry
            | undefined) ?? {};
        aggregateTokenSnapshotCache.set(encodedKey, {
          ...existing,
          ...aggregateTokenListMap,
        });
      });
      return;
    }
    await this.setRawData((rawData) => ({
      ...rawData,
      aggregateTokenListMap: {
        ...rawData?.aggregateTokenListMap,
        [key]: {
          ...rawData?.aggregateTokenListMap?.[key],
          ...aggregateTokenListMap,
        },
      },
    }));
  }

  @backgroundMethod()
  async updateAggregateTokenConfigMap({
    aggregateTokenConfigMap,
    merge = false,
  }: {
    aggregateTokenConfigMap: Record<string, IAggregateToken>;
    merge?: boolean;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      aggregateTokenConfigMap: merge
        ? { ...rawData?.aggregateTokenConfigMap, ...aggregateTokenConfigMap }
        : aggregateTokenConfigMap,
    }));
  }

  @backgroundMethod()
  async updateAllAggregateInfo({
    aggregateTokenConfigMap,
    aggregateTokenSymbolMap,
    homeDefaultTokenMap,
    allAggregateTokenMap,
    allAggregateTokens,
    configSyncMeta,
    merge = false,
  }: {
    allAggregateTokenMap: Record<string, { tokens: IAccountToken[] }>;
    allAggregateTokens: IAccountToken[];
    aggregateTokenConfigMap: Record<string, IAggregateToken>;
    aggregateTokenSymbolMap: Record<string, boolean>;
    homeDefaultTokenMap: Record<string, IHomeDefaultToken>;
    configSyncMeta?: {
      appVersion: string;
      bundleVersion?: string;
      syncedAt: number;
    };
    merge?: boolean;
  }) {
    await this.setRawData((rawData) => ({
      ...rawData,
      configSyncMeta: configSyncMeta ?? rawData?.configSyncMeta,
      aggregateTokenSymbolMap: merge
        ? { ...rawData?.aggregateTokenSymbolMap, ...aggregateTokenSymbolMap }
        : aggregateTokenSymbolMap,
      allAggregateTokenMap: merge
        ? { ...rawData?.allAggregateTokenMap, ...allAggregateTokenMap }
        : allAggregateTokenMap,
      allAggregateTokens: merge
        ? [
            ...(Array.isArray(rawData?.allAggregateTokens)
              ? rawData.allAggregateTokens
              : []),
            ...(Array.isArray(allAggregateTokens) ? allAggregateTokens : []),
          ]
        : allAggregateTokens,
      aggregateTokenConfigMap: merge
        ? { ...rawData?.aggregateTokenConfigMap, ...aggregateTokenConfigMap }
        : aggregateTokenConfigMap,
      homeDefaultTokenMap: merge
        ? { ...rawData?.homeDefaultTokenMap, ...homeDefaultTokenMap }
        : homeDefaultTokenMap,
    }));
  }

  // Drops the sync marker so the next syncWalletConfigIfNeeded re-fetches the
  // wallet config. Used when the server-network set changes, because the
  // cached aggregate-token maps were gated on the previous set.
  @backgroundMethod()
  async clearConfigSyncMeta() {
    await this.setRawData((rawData) => ({
      ...rawData,
      configSyncMeta: undefined,
    }));
  }

  @backgroundMethod()
  async clearLastActiveTabNameData() {
    await this.setRawData((rawData) => {
      return {
        ...rawData,
        tokenDetails: {},
      };
    });
  }

  // Drop per-account aggregate caches belonging to deleted accounts.
  // `aggregateTokenMapV2` / `aggregateTokenListMap` keys are `${networkId}_${accountId}`;
  // `tokenDetails` keys are bare accountIds. `validAccountIds` is the set of
  // lowercased ids of all surviving accounts AND indexed accounts (the all-networks
  // merge mode keys by indexedAccountId). Global config/aggregate maps are left
  // untouched. Pure-cache cleanup. See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validAccountIds }: { validAccountIds: string[] }) {
    const validIdSet = new Set(validAccountIds.map((o) => o.toLowerCase()));
    const filterById = <V>(
      map: Record<string, V> | undefined,
    ): Record<string, V> => {
      const result: Record<string, V> = {};
      for (const [key, value] of Object.entries(map ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({ key, validOwners: validIdSet })
        ) {
          result[key] = value;
        }
      }
      return result;
    };

    if (this.canUseDirectShardedAccess()) {
      if (await isSimpleDbSnapshotPersistenceAllowed()) {
        await ensureSimpleDbSnapshotNamespaceReady(
          AGGREGATE_TOKEN_SNAPSHOT_NAMESPACE,
        );
        await this.mutex.runExclusive(async () => {
          aggregateTokenSnapshotCache.keys().forEach((encodedKey) => {
            const rawKey =
              decodeSnapshotSubKey(AGGREGATE_TOKEN_LIST_PREFIX, encodedKey) ??
              decodeSnapshotSubKey(AGGREGATE_TOKEN_MAP_PREFIX, encodedKey);
            if (
              rawKey !== undefined &&
              !accountUtils.isLocalAssetsKeyOwnedBy({
                key: rawKey,
                validOwners: validIdSet,
              })
            ) {
              aggregateTokenSnapshotCache.remove(encodedKey);
            }
          });
        });
      }
      const existing = await super.getRawData();
      if (!existing) {
        return;
      }
      await this.setRawData((rawData) => {
        if (!rawData) {
          return {};
        }
        const currentTokenDetails = rawData.tokenDetails ?? {};
        const filteredTokenDetails = filterById(currentTokenDetails);
        if (
          Object.keys(currentTokenDetails).length ===
          Object.keys(filteredTokenDetails).length
        ) {
          return rawData;
        }
        return {
          ...rawData,
          tokenDetails: filteredTokenDetails,
        };
      });
      return;
    }

    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot, so
      // a concurrent clearRawData is never undone by an `existing` fallback.
      const base = rawData;
      return {
        ...base,
        aggregateTokenMapV2: filterById(base?.aggregateTokenMapV2),
        aggregateTokenListMap: filterById(base?.aggregateTokenListMap),
        tokenDetails: filterById(base?.tokenDetails),
      };
    });
  }
}
