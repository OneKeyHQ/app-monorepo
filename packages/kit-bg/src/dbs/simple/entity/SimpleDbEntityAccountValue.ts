import { isFunction } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
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

import type ServiceAccount from '../../../services/ServiceAccount/ServiceAccount';

// Stored value entry for a single (networkId, addressOrXpub) pair.
export interface IAccountValueEntry {
  value: string;
  currency: 'usd';
}

// Stored value entry for All Networks aggregate, keyed only by addressOrXpub.
// Inner value is keyed by networkId so a single address shared across multiple
// EVM-compatible networks can hold per-network worth in one entry.
export interface IAllNetworkAccountValueEntry {
  value: Record<string, string>; // <networkId, value>
  currency: 'usd';
}

export interface IAccountValueDb {
  // Single-network worth, key = buildAccountLocalAssetsKey({networkId, accountAddress, xpub}).
  byAddress: Record<string, IAccountValueEntry>;

  // All Networks aggregate worth, key = buildAccountLocalAssetsKey({accountAddress, xpub}) (no networkId).
  // Inner value records per-network worth so callers can iterate or sum.
  allByAddress: Record<string, IAllNetworkAccountValueEntry>;

  // Legacy fields preserved during the one-shot address-key migration so a rollback
  // PR can keep reading old data. Cleaned up in a later release.
  _legacy_data?: Record<string, { value: string; currency: string }>;
  _legacy_all?: Record<
    string,
    { value: Record<string, string>; currency: string }
  >;
  _migratedAt?: number;
  // Migration version. Bumped when the migration logic itself is corrected so we
  // can re-run against the preserved `_legacy_*` snapshot for users that already
  // completed a buggy earlier version.
  _migrationVersion?: number;
}

type ILegacyAccountValueDb = IAccountValueDb & {
  data?: IAccountValueDb['_legacy_data'];
  all?: IAccountValueDb['_legacy_all'];
};

const CURRENT_MIGRATION_VERSION = 1;
const ACCOUNT_VALUE_SNAPSHOT_NAMESPACE = 'sdb-account-value' as const;
const ACCOUNT_VALUE_SINGLE_PREFIX = 'single:';
const ACCOUNT_VALUE_ALL_PREFIX = 'all:';
const ACCOUNT_VALUE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const ACCOUNT_VALUE_MAX_ENTRIES = 512;
const ACCOUNT_VALUE_MAX_RECORD_BYTES = 512 * 1024;

const DEFAULT_APP_STORAGE =
  storageHub.$webStorageSimpleDB || storageHub.appStorage;

type IAccountValueSnapshotValue =
  | IAccountValueEntry
  | IAllNetworkAccountValueEntry;

const accountValueSnapshotCache =
  createSimpleDbSnapshotCache<IAccountValueSnapshotValue>({
    namespace: ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
    maxAgeMs: ACCOUNT_VALUE_MAX_AGE_MS,
    maxEntries: ACCOUNT_VALUE_MAX_ENTRIES,
    maxRecordBytes: ACCOUNT_VALUE_MAX_RECORD_BYTES,
  });

export interface IAccountValueSingleItem {
  networkId: string;
  accountAddress?: string;
  xpub?: string;
}

export interface IAccountValueAllItem {
  accountAddress?: string;
  xpub?: string;
}

export interface IAccountValueAllWriteItem {
  accountAddress?: string;
  xpub?: string;
  networkId: string;
  value: string;
}

function emptyData(): IAccountValueDb {
  return { byAddress: {}, allByAddress: {} };
}

export class SimpleDbEntityAccountValue extends SimpleDbEntityBase<IAccountValueDb> {
  entityName = 'accountValue';

  override enableCache = false;

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

  private readShardedSingleEntry(
    rawKey: string,
  ): IAccountValueEntry | undefined {
    const encodedKey = encodeSnapshotSubKey(
      ACCOUNT_VALUE_SINGLE_PREFIX,
      rawKey,
    );
    return accountValueSnapshotCache.get(encodedKey)?.data as
      | IAccountValueEntry
      | undefined;
  }

  private readShardedAllEntry(
    rawKey: string,
  ): IAllNetworkAccountValueEntry | undefined {
    const encodedKey = encodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, rawKey);
    return accountValueSnapshotCache.get(encodedKey)?.data as
      | IAllNetworkAccountValueEntry
      | undefined;
  }

  private readAllShardedData(): IAccountValueDb | null {
    const keys = accountValueSnapshotCache.keys();
    if (keys.length === 0) {
      return null;
    }
    const byAddress: Record<string, IAccountValueEntry> = {};
    const allByAddress: Record<string, IAllNetworkAccountValueEntry> = {};
    let hasAny = false;

    keys.forEach((encodedKey) => {
      const singleKey = decodeSnapshotSubKey(
        ACCOUNT_VALUE_SINGLE_PREFIX,
        encodedKey,
      );
      if (singleKey !== undefined) {
        const entry = accountValueSnapshotCache.get(encodedKey)?.data as
          | IAccountValueEntry
          | undefined;
        if (entry) {
          byAddress[singleKey] = entry;
          hasAny = true;
        }
        return;
      }
      const allKey = decodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, encodedKey);
      if (allKey !== undefined) {
        const entry = accountValueSnapshotCache.get(encodedKey)?.data as
          | IAllNetworkAccountValueEntry
          | undefined;
        if (entry) {
          allByAddress[allKey] = entry;
          hasAny = true;
        }
      }
    });

    return hasAny ? { byAddress, allByAddress } : null;
  }

  private writeAllShardedData(
    rawData: IAccountValueDb | null | undefined,
  ): void {
    if (!rawData) {
      accountValueSnapshotCache.clear();
      return;
    }
    const nextEncodedKeys = new Set<string>();
    const entriesToWrite: Array<readonly [string, IAccountValueSnapshotValue]> =
      [];

    for (const [rawKey, entry] of Object.entries(rawData.byAddress ?? {})) {
      const encodedKey = encodeSnapshotSubKey(
        ACCOUNT_VALUE_SINGLE_PREFIX,
        rawKey,
      );
      nextEncodedKeys.add(encodedKey);
      entriesToWrite.push([encodedKey, entry]);
    }
    for (const [rawKey, entry] of Object.entries(rawData.allByAddress ?? {})) {
      const encodedKey = encodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, rawKey);
      nextEncodedKeys.add(encodedKey);
      entriesToWrite.push([encodedKey, entry]);
    }

    accountValueSnapshotCache.keys().forEach((existingKey) => {
      if (!nextEncodedKeys.has(existingKey)) {
        accountValueSnapshotCache.remove(existingKey);
      }
    });

    if (entriesToWrite.length > 0) {
      accountValueSnapshotCache.setMany(entriesToWrite);
    }
  }

  @backgroundMethod()
  override async getRawData(): Promise<IAccountValueDb | undefined | null> {
    if (!this.usesNativeSnapshotCache()) {
      return super.getRawData();
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return undefined;
    }
    await ensureSimpleDbSnapshotNamespaceReady(
      ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
    );
    return this.readAllShardedData();
  }

  @backgroundMethod()
  override async setRawData(
    dataOrBuilder:
      | IAccountValueDb
      | ((rawData: IAccountValueDb | null | undefined) => IAccountValueDb)
      | ((
          rawData: IAccountValueDb | null | undefined,
        ) => Promise<IAccountValueDb>),
  ): Promise<IAccountValueDb | undefined> {
    if (!this.usesNativeSnapshotCache()) {
      return super.setRawData(dataOrBuilder);
    }
    return this.setRawDataWithCommitGuard(dataOrBuilder);
  }

  protected override async setRawDataWithCommitGuard(
    dataOrBuilder:
      | IAccountValueDb
      | ((rawData: IAccountValueDb | null | undefined) => IAccountValueDb)
      | ((
          rawData: IAccountValueDb | null | undefined,
        ) => Promise<IAccountValueDb>),
    assertCanCommit?: () => void,
    onCommitted?: (data: IAccountValueDb) => void,
  ): Promise<IAccountValueDb | undefined> {
    if (!this.usesNativeSnapshotCache()) {
      return super.setRawDataWithCommitGuard(
        dataOrBuilder,
        assertCanCommit,
        onCommitted,
      );
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return undefined;
    }
    await ensureSimpleDbSnapshotNamespaceReady(
      ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
    );
    return this.mutex.runExclusive(async () => {
      assertCanCommit?.();
      let nextData: IAccountValueDb;
      if (isFunction(dataOrBuilder)) {
        const current = this.readAllShardedData();
        assertCanCommit?.();
        nextData = await dataOrBuilder(current);
        if (current !== null && Object.is(nextData, current)) {
          onCommitted?.(nextData);
          return nextData;
        }
      } else {
        nextData = dataOrBuilder;
      }
      assertCanCommit?.();
      this.writeAllShardedData(nextData);
      onCommitted?.(nextData);
      return nextData;
    });
  }

  @backgroundMethod()
  override async clearRawData(): Promise<void> {
    if (!this.usesNativeSnapshotCache()) {
      await super.clearRawData();
      return;
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return;
    }
    await ensureSimpleDbSnapshotNamespaceReady(
      ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
    );
    await this.mutex.runExclusive(async () => {
      // Remove the source before its marker so a failed clear cannot re-import it.
      await this.appStorage.removeItem(this.entityKey);
      await this.appStorage.removeItem(this.snapshotMigrationKey);
      accountValueSnapshotCache.clear();
    });
  }

  private buildSingleKey({
    networkId,
    accountAddress,
    xpub,
  }: IAccountValueSingleItem): string | null {
    if (!accountAddress && !xpub) {
      return null;
    }
    return accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
  }

  private buildAllKey({
    accountAddress,
    xpub,
  }: IAccountValueAllItem): string | null {
    if (!accountAddress && !xpub) {
      return null;
    }
    return accountUtils.buildAccountLocalAssetsKey({
      accountAddress,
      xpub,
    });
  }

  async getAccountsValue({ items }: { items: IAccountValueSingleItem[] }) {
    if (this.canUseDirectShardedAccess()) {
      const allowed = await isSimpleDbSnapshotPersistenceAllowed();
      if (allowed) {
        await ensureSimpleDbSnapshotNamespaceReady(
          ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
        );
      }
      return items.map((it) => {
        const key = this.buildSingleKey(it);
        const entry =
          allowed && key ? this.readShardedSingleEntry(key) : undefined;
        return {
          value: entry?.value,
          currency: entry?.currency,
        };
      });
    }
    const raw = await this.getRawData();
    return items.map((it) => {
      const key = this.buildSingleKey(it);
      const entry = key ? raw?.byAddress?.[key] : undefined;
      return {
        value: entry?.value,
        currency: entry?.currency,
      };
    });
  }

  async updateAccountValue({
    networkId,
    accountAddress,
    xpub,
    value,
    currency,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    value: string;
    currency: 'usd';
  }) {
    const key = this.buildSingleKey({ networkId, accountAddress, xpub });
    if (!key) {
      return;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        const existing = this.readShardedSingleEntry(key);
        if (existing?.value === value && existing?.currency === currency) {
          return;
        }
        accountValueSnapshotCache.set(
          encodeSnapshotSubKey(ACCOUNT_VALUE_SINGLE_PREFIX, key),
          { value, currency },
        );
      });
      return;
    }
    const existing = (await this.getRawData())?.byAddress?.[key];
    if (existing?.value === value && existing?.currency === currency) {
      return;
    }
    await this.setRawData((rawData) => {
      const base = rawData ?? emptyData();
      return {
        ...base,
        byAddress: {
          ...base.byAddress,
          [key]: { value, currency },
        },
      };
    });
  }

  async getAllNetworkAccountsValue({
    items,
  }: {
    items: IAccountValueAllItem[];
  }) {
    if (this.canUseDirectShardedAccess()) {
      const allowed = await isSimpleDbSnapshotPersistenceAllowed();
      if (allowed) {
        await ensureSimpleDbSnapshotNamespaceReady(
          ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
        );
      }
      return items.map((it) => {
        const key = this.buildAllKey(it);
        const entry =
          allowed && key ? this.readShardedAllEntry(key) : undefined;
        return {
          value: entry?.value,
          currency: entry?.currency,
        };
      });
    }
    const raw = await this.getRawData();
    return items.map((it) => {
      const key = this.buildAllKey(it);
      const entry = key ? raw?.allByAddress?.[key] : undefined;
      return {
        value: entry?.value,
        currency: entry?.currency,
      };
    });
  }

  // Clears both the single-network and All Networks keys.
  async removeAccountNetworkValue({
    networkId,
    accountAddress,
    xpub,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
  }) {
    const owners = [xpub, accountAddress].filter((o): o is string => !!o);
    if (owners.length === 0) return;

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        owners.forEach((owner) => {
          const singleKey = accountUtils.buildAccountLocalAssetsKey({
            networkId,
            accountAddress: owner,
          });
          accountValueSnapshotCache.remove(
            encodeSnapshotSubKey(ACCOUNT_VALUE_SINGLE_PREFIX, singleKey),
          );
          const allKey = accountUtils.buildAccountLocalAssetsKey({
            accountAddress: owner,
          });
          const entry = this.readShardedAllEntry(allKey);
          if (entry && networkId in entry.value) {
            const value = { ...entry.value };
            delete value[networkId];
            accountValueSnapshotCache.set(
              encodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, allKey),
              { ...entry, value },
            );
          }
        });
      });
      return;
    }

    await this.setRawData((rawData) => {
      const base = rawData ?? emptyData();
      const byAddress = { ...base.byAddress };
      const allByAddress = { ...base.allByAddress };
      owners.forEach((owner) => {
        delete byAddress[
          accountUtils.buildAccountLocalAssetsKey({
            networkId,
            accountAddress: owner,
          })
        ];
        const allKey = accountUtils.buildAccountLocalAssetsKey({
          accountAddress: owner,
        });
        const entry = allByAddress[allKey];
        if (entry && networkId in entry.value) {
          const value = { ...entry.value };
          delete value[networkId];
          allByAddress[allKey] = { ...entry, value };
        }
      });
      return { ...base, byAddress, allByAddress };
    });
  }

  async updateAllNetworkAccountValue({
    items,
    currency,
    updateAll,
  }: {
    items: IAccountValueAllWriteItem[];
    currency: 'usd';
    updateAll?: boolean;
  }) {
    // Group write items by addressKey so a single setRawData call handles
    // multi-network entries that share the same address.
    const grouped: Record<string, Record<string, string>> = {};
    for (const it of items) {
      const key = this.buildAllKey(it);
      if (key) {
        grouped[key] = { ...grouped[key], [it.networkId]: it.value };
      }
    }
    if (Object.keys(grouped).length === 0) {
      return;
    }

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        const entriesToWrite: Array<
          readonly [string, IAccountValueSnapshotValue]
        > = [];
        for (const [key, valueMap] of Object.entries(grouped)) {
          const prev = this.readShardedAllEntry(key);
          const isSingleNoop = (() => {
            if (!prev || prev.currency !== currency) return false;
            if (updateAll) {
              const prevKeys = Object.keys(prev.value);
              const nextKeys = Object.keys(valueMap);
              if (prevKeys.length !== nextKeys.length) return false;
              return nextKeys.every((nId) => prev.value[nId] === valueMap[nId]);
            }
            return Object.entries(valueMap).every(
              ([nId, v]) => prev.value[nId] === v,
            );
          })();
          if (!isSingleNoop) {
            entriesToWrite.push([
              encodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, key),
              {
                value: updateAll ? valueMap : { ...prev?.value, ...valueMap },
                currency,
              },
            ]);
          }
        }
        if (entriesToWrite.length > 0) {
          accountValueSnapshotCache.setMany(entriesToWrite);
        }
      });
      return;
    }

    const existingMap = (await this.getRawData())?.allByAddress ?? {};
    const isNoop = Object.entries(grouped).every(([key, valueMap]) => {
      const prev = existingMap[key];
      if (!prev || prev.currency !== currency) return false;
      if (updateAll) {
        // Replace mode: the existing map must match the incoming snapshot
        // exactly, otherwise we still need to write to drop stale networkIds.
        const prevKeys = Object.keys(prev.value);
        const nextKeys = Object.keys(valueMap);
        if (prevKeys.length !== nextKeys.length) return false;
        return nextKeys.every((nId) => prev.value[nId] === valueMap[nId]);
      }
      return Object.entries(valueMap).every(
        ([nId, v]) => prev.value[nId] === v,
      );
    });
    if (isNoop) {
      return;
    }

    await this.setRawData((rawData) => {
      const base = rawData ?? emptyData();
      const existing = base.allByAddress;
      const next: Record<string, IAllNetworkAccountValueEntry> = {
        ...existing,
      };
      for (const [key, valueMap] of Object.entries(grouped)) {
        next[key] = {
          value: updateAll
            ? valueMap
            : { ...existing[key]?.value, ...valueMap },
          currency,
        };
      }
      return {
        ...base,
        allByAddress: next,
      };
    });
  }

  // One-shot migration from the legacy accountId-keyed `data` / `all` shape
  // to the address-keyed shape. Idempotent via `_migrationVersion`; bump
  // `CURRENT_MIGRATION_VERSION` to re-run against the preserved `_legacy_*`
  // snapshot when the migration logic itself changes.
  async migrateFromAccountIdToAddressKey({
    serviceAccount,
  }: {
    serviceAccount: ServiceAccount;
  }) {
    if (this.canUseDirectShardedAccess()) {
      await this.migrateLegacySnapshotToShards(serviceAccount);
      return;
    }
    const raw = (await this.getRawData()) as
      | ILegacyAccountValueDb
      | null
      | undefined;

    if (!raw) {
      return;
    }
    if ((raw._migrationVersion ?? 0) >= CURRENT_MIGRATION_VERSION) {
      return;
    }

    // For v0 (never migrated) the snapshot lives under `data` / `all`; for
    // earlier buggy migration versions the originals were preserved into
    // `_legacy_*` so we can re-run.
    const legacyData = raw.data ?? raw._legacy_data ?? {};
    const legacyAll = raw.all ?? raw._legacy_all ?? {};
    if (
      Object.keys(legacyData).length === 0 &&
      Object.keys(legacyAll).length === 0
    ) {
      await this.setRawData((current) => ({
        ...(current ?? emptyData()),
        byAddress: current?.byAddress ?? {},
        allByAddress: current?.allByAddress ?? {},
        _migratedAt: Date.now(),
        _migrationVersion: CURRENT_MIGRATION_VERSION,
      }));
      return;
    }

    const { byAddress, allByAddress, hadResolveError } =
      await this.resolveLegacyAccountValues({
        legacyData,
        legacyAll,
        serviceAccount,
      });

    await this.setRawData((current) => {
      // Merge so that any writes that landed during the migration window —
      // and any post-migration writes preserved across a version-bump
      // re-run — survive. `current` wins over the legacy-derived snapshot;
      // legacy values only fill keys that don't already exist.
      const mergedByAddress: Record<string, IAccountValueEntry> = {
        ...byAddress,
        ...current?.byAddress,
      };
      const mergedAllByAddress: Record<string, IAllNetworkAccountValueEntry> = {
        ...current?.allByAddress,
      };
      for (const [key, legacyEntry] of Object.entries(allByAddress)) {
        const cur = mergedAllByAddress[key];
        mergedAllByAddress[key] = cur
          ? {
              value: { ...legacyEntry.value, ...cur.value },
              currency: cur.currency,
            }
          : legacyEntry;
      }

      return {
        ...(current ?? emptyData()),
        byAddress: mergedByAddress,
        allByAddress: mergedAllByAddress,
        // Preserve legacy snapshot once, even on re-run, so a future
        // migration version can re-derive without losing data.
        _legacy_data: current?._legacy_data ?? legacyData,
        _legacy_all: current?._legacy_all ?? legacyAll,
        _migratedAt: Date.now(),
        // Hold the version back when any legacy entry failed to resolve so
        // a later launch retries; otherwise a single transient DB error
        // would permanently strip that account's cached worth.
        _migrationVersion: hadResolveError
          ? (current?._migrationVersion ?? 0)
          : CURRENT_MIGRATION_VERSION,
      };
    });

    // Nudge consumers that already read the empty buckets during the
    // pre-migration window to re-fetch and pick up the freshly-merged data.
    appEventBus.emit(EAppEventBusNames.AccountValueUpdate, undefined);
  }

  private get snapshotMigrationKey(): string {
    return `${this.entityKey}:snapshot-migration-v1`;
  }

  private async migrateLegacySnapshotToShards(serviceAccount: ServiceAccount) {
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return;
    }
    await ensureSimpleDbSnapshotNamespaceReady(
      ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
    );
    const published = await this.mutex.runExclusive(async () => {
      if (await this.appStorage.getItem(this.snapshotMigrationKey)) {
        return false;
      }
      const raw = (await super.getRawData()) as
        | ILegacyAccountValueDb
        | null
        | undefined;
      if (!raw) {
        return false;
      }
      const resolved =
        (raw._migrationVersion ?? 0) < CURRENT_MIGRATION_VERSION
          ? await this.resolveLegacyAccountValues({
              legacyData: raw.data ?? raw._legacy_data ?? {},
              legacyAll: raw.all ?? raw._legacy_all ?? {},
              serviceAccount,
            })
          : undefined;
      const entries: Array<readonly [string, IAccountValueSnapshotValue]> = [];
      let available = Math.max(
        0,
        ACCOUNT_VALUE_MAX_ENTRIES - accountValueSnapshotCache.keys().length,
      );
      for (const [key, entry] of Object.entries({
        ...resolved?.byAddress,
        ...raw.byAddress,
      })) {
        if (available > 0 && !this.readShardedSingleEntry(key)) {
          entries.push([
            encodeSnapshotSubKey(ACCOUNT_VALUE_SINGLE_PREFIX, key),
            entry,
          ]);
          available -= 1;
        }
      }
      const legacyAll = { ...resolved?.allByAddress };
      for (const [key, entry] of Object.entries(raw.allByAddress ?? {})) {
        legacyAll[key] = {
          ...entry,
          value: { ...legacyAll[key]?.value, ...entry.value },
        };
      }
      for (const [key, entry] of Object.entries(legacyAll)) {
        const current = this.readShardedAllEntry(key);
        if (current) {
          if (
            Object.keys(entry.value).some(
              (networkId) => !Object.hasOwn(current.value, networkId),
            )
          ) {
            entries.push([
              encodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, key),
              { ...current, value: { ...entry.value, ...current.value } },
            ]);
          }
        } else if (available > 0) {
          entries.push([
            encodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, key),
            entry,
          ]);
          available -= 1;
        }
      }
      const accepted =
        entries.length === 0 || accountValueSnapshotCache.setMany(entries);
      if (accepted && !resolved?.hadResolveError) {
        // Keep the legacy source for rollback. The marker has no cache expiry.
        await this.appStorage.setItem(this.snapshotMigrationKey, '1');
      }
      return accepted && entries.length > 0;
    });
    if (published) {
      appEventBus.emit(EAppEventBusNames.AccountValueUpdate, undefined);
    }
  }

  private async resolveLegacyAccountValues({
    legacyData,
    legacyAll,
    serviceAccount,
  }: {
    legacyData: NonNullable<IAccountValueDb['_legacy_data']>;
    legacyAll: NonNullable<IAccountValueDb['_legacy_all']>;
    serviceAccount: ServiceAccount;
  }) {
    const byAddress: Record<string, IAccountValueEntry> = {};
    const allByAddress: Record<string, IAllNetworkAccountValueEntry> = {};

    // Track transient resolve failures so we can hold back the migration
    // version bump and retry on a later launch instead of permanently
    // dropping a legacy entry.
    let hadResolveError = false;

    // Cache DB-account lookups; the same networkAccountId can appear under
    // many networkIds in legacy `all`.
    const accountResolveCache = new Map<
      string,
      { accountAddress?: string; xpub?: string } | null
    >();
    const resolveByAccountId = async (accountId: string) => {
      const cached = accountResolveCache.get(accountId);
      if (cached !== undefined) return cached;
      try {
        const account = await serviceAccount.getDBAccount({ accountId });
        if (!account) {
          accountResolveCache.set(accountId, null);
          return null;
        }
        const xpub = accountUtils.pickXpubFromDBAccount(account);
        if (!account.address && !xpub) {
          accountResolveCache.set(accountId, null);
          return null;
        }
        const resolved = { accountAddress: account.address, xpub };
        accountResolveCache.set(accountId, resolved);
        return resolved;
      } catch {
        hadResolveError = true;
        defaultLogger.app.bootstrap.initDeferredStepFailed(
          `accountValue.migrate.resolveAccount[${accountId}]`,
          0,
        );
        accountResolveCache.set(accountId, null);
        return null;
      }
    };

    // Legacy `data` was only ever populated by Others accounts at their
    // createAtNetwork. Skip anything that doesn't fit that shape.
    for (const [oldKey, entry] of Object.entries(legacyData)) {
      if (
        entry?.currency === 'usd' &&
        accountUtils.isOthersAccount({ accountId: oldKey })
      ) {
        try {
          const account = await serviceAccount.getDBAccount({
            accountId: oldKey,
          });
          if (account?.createAtNetwork) {
            const addressKey = accountUtils.buildAccountLocalAssetsKey({
              networkId: account.createAtNetwork,
              accountAddress: account.address,
              xpub: accountUtils.pickXpubFromDBAccount(account),
            });
            byAddress[addressKey] = { value: entry.value, currency: 'usd' };
          }
        } catch {
          hadResolveError = true;
          defaultLogger.app.bootstrap.initDeferredStepFailed(
            `accountValue.migrate.legacyData[${oldKey}]`,
            0,
          );
          // Skip records that fail to resolve; legacy snapshot stays preserved
          // in `_legacy_data` so a later version can retry.
        }
      }
    }

    // Legacy `all` inner map keys are `${networkAccountId}_${networkId}` from
    // `buildAccountValueKey`. Resolve each inner accountId to its address/xpub
    // and emit one address-keyed entry per (address, networkId).
    for (const [, entry] of Object.entries(legacyAll)) {
      if (entry?.currency === 'usd') {
        for (const [compoundKey, worth] of Object.entries(entry.value)) {
          const parsed = accountUtils.parseAccountValueKey({
            key: compoundKey,
          });
          if (parsed.accountId && parsed.networkId) {
            const resolved = await resolveByAccountId(parsed.accountId);
            if (resolved) {
              const addressKey = accountUtils.buildAccountLocalAssetsKey({
                accountAddress: resolved.accountAddress,
                xpub: resolved.xpub,
              });
              const existing = allByAddress[addressKey];
              allByAddress[addressKey] = {
                value: {
                  ...existing?.value,
                  [parsed.networkId]: worth,
                },
                currency: 'usd',
              };
            }
          }
        }
      }
    }

    return { byAddress, allByAddress, hadResolveError };
  }

  // Drop cached worth belonging to deleted accounts. `byAddress` keys are
  // networkId-prefixed; `allByAddress` keys are bare addresses/xpubs. `validOwners`
  // is the set of lowercased addresses/xpubs of all surviving accounts. The
  // `_legacy_*` / migration fields are preserved. Pure-cache cleanup.
  // See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        ACCOUNT_VALUE_SNAPSHOT_NAMESPACE,
      );
      const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
      await this.mutex.runExclusive(async () => {
        accountValueSnapshotCache.keys().forEach((encodedKey) => {
          const singleKey = decodeSnapshotSubKey(
            ACCOUNT_VALUE_SINGLE_PREFIX,
            encodedKey,
          );
          const rawKey =
            singleKey !== undefined
              ? singleKey
              : decodeSnapshotSubKey(ACCOUNT_VALUE_ALL_PREFIX, encodedKey);
          if (
            rawKey !== undefined &&
            !accountUtils.isLocalAssetsKeyOwnedBy({
              key: rawKey,
              validOwners: validOwnerSet,
            })
          ) {
            accountValueSnapshotCache.remove(encodedKey);
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
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot:
      // a concurrent clearRawData (e.g. "Clear cache") nulls the store, and
      // falling back to `existing` would resurrect the just-cleared cache.
      const base = rawData;
      const nextByAddress: Record<string, IAccountValueEntry> = {};
      for (const [key, value] of Object.entries(base?.byAddress ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextByAddress[key] = value;
        }
      }
      const nextAllByAddress: Record<string, IAllNetworkAccountValueEntry> = {};
      for (const [key, value] of Object.entries(base?.allByAddress ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextAllByAddress[key] = value;
        }
      }
      return {
        ...(base ?? emptyData()),
        byAddress: nextByAddress,
        allByAddress: nextAllByAddress,
      };
    });
  }
}
