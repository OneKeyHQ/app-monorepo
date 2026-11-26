import { isFunction } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAccountNFT } from '@onekeyhq/shared/types/nft';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';
import {
  createSimpleDbSnapshotCache,
  decodeSnapshotSubKey,
  encodeSnapshotSubKey,
  ensureSimpleDbSnapshotNamespaceReady,
  isEntityMethodMocked,
  isSimpleDbSnapshotPersistenceAllowed,
} from '../base/simpleDbSnapshotCacheUtils';

// Per-account NFT array cap. NFT entries embed full-resolution image URLs and
// metadata, so an NFT-whale account can bloat this map. Pure cache (re-fetched),
// so capping is safe; 500 covers the visible list comfortably.
const LOCAL_NFTS_MAX_PER_ACCOUNT = 500;
const LOCAL_NFTS_SNAPSHOT_NAMESPACE = 'sdb-local-nfts' as const;
const LOCAL_NFTS_KEY_PREFIX = 'acct:';
const LOCAL_NFTS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_NFTS_MAX_ENTRIES = 256;
const LOCAL_NFTS_MAX_RECORD_BYTES = 2 * 1024 * 1024;

const DEFAULT_APP_STORAGE =
  storageHub.$webStorageSimpleDB || storageHub.appStorage;

const localNftsSnapshotCache = createSimpleDbSnapshotCache<IAccountNFT[]>({
  namespace: LOCAL_NFTS_SNAPSHOT_NAMESPACE,
  maxAgeMs: LOCAL_NFTS_MAX_AGE_MS,
  maxEntries: LOCAL_NFTS_MAX_ENTRIES,
  maxRecordBytes: LOCAL_NFTS_MAX_RECORD_BYTES,
});

export interface ILocalNFTs {
  list: Record<string, IAccountNFT[]>; // <networkId_accountAddress/xpub, nfts>
}

export class SimpleDbEntityLocalNFTs extends SimpleDbEntityBase<ILocalNFTs> {
  entityName = 'LocalNFTs';

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

  private readAllShardedData(): ILocalNFTs | null {
    const keys = localNftsSnapshotCache.keys();
    if (keys.length === 0) {
      return null;
    }
    const list: Record<string, IAccountNFT[]> = {};
    let hasAny = false;
    keys.forEach((encodedKey) => {
      const rawKey = decodeSnapshotSubKey(LOCAL_NFTS_KEY_PREFIX, encodedKey);
      if (rawKey === undefined) {
        return;
      }
      const entry = localNftsSnapshotCache.get(encodedKey);
      if (entry?.data) {
        list[rawKey] = entry.data;
        hasAny = true;
      }
    });
    return hasAny ? { list } : null;
  }

  private writeAllShardedData(data: ILocalNFTs | null | undefined): void {
    const nextList = data?.list ?? {};
    const nextEncodedKeys = new Set<string>();
    const entriesToWrite: Array<readonly [string, IAccountNFT[]]> = [];
    for (const [rawKey, value] of Object.entries(nextList)) {
      const encodedKey = encodeSnapshotSubKey(LOCAL_NFTS_KEY_PREFIX, rawKey);
      nextEncodedKeys.add(encodedKey);
      entriesToWrite.push([
        encodedKey,
        value.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT),
      ]);
    }
    localNftsSnapshotCache.keys().forEach((existingEncodedKey) => {
      if (
        existingEncodedKey.startsWith(LOCAL_NFTS_KEY_PREFIX) &&
        !nextEncodedKeys.has(existingEncodedKey)
      ) {
        localNftsSnapshotCache.remove(existingEncodedKey);
      }
    });
    if (entriesToWrite.length > 0) {
      localNftsSnapshotCache.setMany(entriesToWrite);
    }
  }

  @backgroundMethod()
  override async getRawData(): Promise<ILocalNFTs | undefined | null> {
    if (!this.usesNativeSnapshotCache()) {
      return super.getRawData();
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return undefined;
    }
    await ensureSimpleDbSnapshotNamespaceReady(LOCAL_NFTS_SNAPSHOT_NAMESPACE);
    return this.readAllShardedData();
  }

  @backgroundMethod()
  override async setRawData(
    dataOrBuilder:
      | ILocalNFTs
      | ((rawData: ILocalNFTs | null | undefined) => ILocalNFTs)
      | ((rawData: ILocalNFTs | null | undefined) => Promise<ILocalNFTs>),
  ): Promise<ILocalNFTs | undefined> {
    if (!this.usesNativeSnapshotCache()) {
      return super.setRawData(dataOrBuilder);
    }
    return this.setRawDataWithCommitGuard(dataOrBuilder);
  }

  protected override async setRawDataWithCommitGuard(
    dataOrBuilder:
      | ILocalNFTs
      | ((rawData: ILocalNFTs | null | undefined) => ILocalNFTs)
      | ((rawData: ILocalNFTs | null | undefined) => Promise<ILocalNFTs>),
    assertCanCommit?: () => void,
    onCommitted?: (data: ILocalNFTs) => void,
  ): Promise<ILocalNFTs | undefined> {
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
    await ensureSimpleDbSnapshotNamespaceReady(LOCAL_NFTS_SNAPSHOT_NAMESPACE);
    return this.mutex.runExclusive(async () => {
      assertCanCommit?.();
      let nextData: ILocalNFTs;
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
    if (await isSimpleDbSnapshotPersistenceAllowed()) {
      await ensureSimpleDbSnapshotNamespaceReady(LOCAL_NFTS_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        localNftsSnapshotCache.clear();
      });
    }
    await super.clearRawData().catch(() => undefined);
  }

  @backgroundMethod()
  async updateAccountNFTs({
    networkId,
    accountAddress,
    xpub,
    nfts,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    nfts: IAccountNFT[];
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
    const capped = nfts.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT);

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(LOCAL_NFTS_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        localNftsSnapshotCache.set(
          encodeSnapshotSubKey(LOCAL_NFTS_KEY_PREFIX, key),
          capped,
        );
      });
      return;
    }

    await this.setRawData((rawData) => ({
      list: {
        ...rawData?.list,
        [key]: capped,
      },
    }));
  }

  @backgroundMethod()
  async updateAccountNFTsByCache(nfts: Record<string, IAccountNFT[]>) {
    const capped: Record<string, IAccountNFT[]> = {};
    for (const [key, value] of Object.entries(nfts)) {
      capped[key] = value.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT);
    }

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(LOCAL_NFTS_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        localNftsSnapshotCache.setMany(
          Object.entries(capped).map(
            ([key, value]) =>
              [
                encodeSnapshotSubKey(LOCAL_NFTS_KEY_PREFIX, key),
                value,
              ] as const,
          ),
        );
      });
      return;
    }

    await this.setRawData((rawData) => ({
      list: {
        ...rawData?.list,
        ...capped,
      },
    }));
  }

  @backgroundMethod()
  async getAccountNFTs({
    networkId,
    accountAddress,
    xpub,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
  }) {
    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return [];
      }
      await ensureSimpleDbSnapshotNamespaceReady(LOCAL_NFTS_SNAPSHOT_NAMESPACE);
      return (
        localNftsSnapshotCache.get(
          encodeSnapshotSubKey(LOCAL_NFTS_KEY_PREFIX, key),
        )?.data || []
      );
    }

    return (await this.getRawData())?.list?.[key] || [];
  }

  // Drop cached NFT lists belonging to deleted accounts and cap surviving arrays.
  // `validOwners` is the set of lowercased addresses/xpubs of all surviving
  // accounts. Pure-cache cleanup. See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(LOCAL_NFTS_SNAPSHOT_NAMESPACE);
      const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
      await this.mutex.runExclusive(async () => {
        localNftsSnapshotCache.keys().forEach((encodedKey) => {
          const rawKey = decodeSnapshotSubKey(
            LOCAL_NFTS_KEY_PREFIX,
            encodedKey,
          );
          if (rawKey === undefined) {
            return;
          }
          if (
            !accountUtils.isLocalAssetsKeyOwnedBy({
              key: rawKey,
              validOwners: validOwnerSet,
            })
          ) {
            localNftsSnapshotCache.remove(encodedKey);
            return;
          }
          const current = localNftsSnapshotCache.get(encodedKey)?.data;
          if (current && current.length > LOCAL_NFTS_MAX_PER_ACCOUNT) {
            localNftsSnapshotCache.set(
              encodedKey,
              current.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT),
            );
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
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot: a
      // concurrent clearRawData ("Clear cache" calls localNFTs.clearRawData)
      // nulls the store, and falling back to `existing` would resurrect it.
      const list = rawData?.list ?? {};
      const nextList: Record<string, IAccountNFT[]> = {};
      for (const [key, value] of Object.entries(list)) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          nextList[key] = value.slice(0, LOCAL_NFTS_MAX_PER_ACCOUNT);
        }
      }
      return { list: nextList };
    });
  }
}
