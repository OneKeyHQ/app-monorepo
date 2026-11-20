import { isFunction, keyBy, merge, omit } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import perfUtils, {
  EPerformanceTimerLogNames,
} from '@onekeyhq/shared/src/utils/debug/perfUtils';
import type {
  IAccountToken,
  IHomeTokenRequest,
  IToken,
  ITokenFiat,
} from '@onekeyhq/shared/types/token';

import { homeTokenRequestRegistry } from '../../../utils/homeTokenRequestRegistry';
import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';
import {
  createSimpleDbSnapshotCache,
  decodeSnapshotSubKey,
  encodeSnapshotSubKey,
  ensureSimpleDbSnapshotNamespaceReady,
  isEntityMethodMocked,
  isSimpleDbSnapshotPersistenceAllowed,
} from '../base/simpleDbSnapshotCacheUtils';

// Cap for the global token-metadata map (`data`, keyed by networkId_tokenAddress).
// It is merge-only and not per-account, so it can't be orphan-filtered; instead we
// bound it. Entries are pure cache (re-fetched on miss), so dropping the oldest is
// safe. 5000 covers any realistic multi-chain wallet's working set.
const LOCAL_TOKENS_METADATA_MAX_ENTRIES = 5000;
const LOCAL_TOKENS_SNAPSHOT_NAMESPACE = 'sdb-local-tokens' as const;
const LOCAL_TOKENS_META_KEY = 'token-meta';
const LOCAL_TOKENS_ACCT_PREFIX = 'acct:';
const LOCAL_TOKENS_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const LOCAL_TOKENS_MAX_ENTRIES = 512;
const LOCAL_TOKENS_MAX_RECORD_BYTES = 4 * 1024 * 1024;

const DEFAULT_APP_STORAGE =
  storageHub.$webStorageSimpleDB || storageHub.appStorage;

type ILocalTokensAccountRecord = {
  tokenList: IAccountToken[];
  smallBalanceTokenList: IAccountToken[];
  riskyTokenList: IAccountToken[];
  tokenListMap: Record<string, ITokenFiat>;
  tokenListValue: string;
  currency?: string;
  hasAssets?: boolean;
};

type ILocalTokensSnapshotValue =
  | Record<string, IToken>
  | ILocalTokensAccountRecord;

const localTokensSnapshotCache =
  createSimpleDbSnapshotCache<ILocalTokensSnapshotValue>({
    namespace: LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
    maxAgeMs: LOCAL_TOKENS_MAX_AGE_MS,
    maxEntries: LOCAL_TOKENS_MAX_ENTRIES,
    maxRecordBytes: LOCAL_TOKENS_MAX_RECORD_BYTES,
  });

export interface ISimpleDBLocalTokens {
  data: Record<string, IToken>; // <networkId_tokenIdOnNetwork, token>
  tokenList: Record<string, IAccountToken[]>; // <networkId_accountAddress/xpub, IAccountToken[]>
  smallBalanceTokenList: Record<string, IAccountToken[]>; // <networkId_accountAddress/xpub, IAccountToken[]>
  riskyTokenList: Record<string, IAccountToken[]>; // <networkId_accountAddress/xpub, IAccountToken[]>
  tokenListMap: Record<string, Record<string, ITokenFiat>>; // <networkId_accountAddress/xpub, Record<string, ITokenFiat>>
  tokenListValue: Record<string, string>; // <networkId_accountAddress/xpub, string>
  // Per-key currency tag for tokenListMap / tokenListValue. Missing keys are
  // pre-migration entries in the user's then-active display currency;
  // ServiceToken supplies the lazy fallback.
  tokenListCurrency?: Record<string, string>;
  // Per-key: whether the complete response held any amount. The saved lists
  // are capped, so a holding beyond the cap is missing from them. Missing keys
  // predate this field: unknown.
  tokenListHasAssets?: Record<string, boolean>;
}

// Pending per-key snapshots flushed in one write. `tokenListWriteOrder` holds
// the reserved write order of each ordered entry; keys without one commit
// unconditionally.
export interface IAccountTokenListCache {
  tokenList: Record<string, IAccountToken[]>;
  smallBalanceTokenList: Record<string, IAccountToken[]>;
  riskyTokenList: Record<string, IAccountToken[]>;
  tokenListValue: Record<string, string>;
  tokenListMap: Record<string, Record<string, ITokenFiat>>;
  tokenListCurrency: Record<string, string>;
  tokenListHasAssets: Record<string, boolean>;
  tokenListWriteOrder?: Record<string, number>;
}

export class SimpleDbEntityLocalTokens extends SimpleDbEntityBase<ISimpleDBLocalTokens> {
  entityName = 'localTokens';

  override enableCache = false;

  // Responses for the same account/network can resolve out of request order
  // (e.g. A -> B -> A where the first A request is slow). Writes carry the
  // order in which their request started; one older than the newest committed
  // write for its key is skipped, so a late response cannot overwrite fresher
  // balances. Owner retirement alone does not drop a completed snapshot.
  private accountTokenListWriteOrder = 0;

  private committedAccountTokenListWriteOrder = new Map<string, number>();

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

  private readShardedTokenMeta(): Record<string, IToken> {
    const entry = localTokensSnapshotCache.get(LOCAL_TOKENS_META_KEY);
    return (entry?.data as Record<string, IToken> | undefined) ?? {};
  }

  private readShardedAccountRecord(
    rawKey: string,
  ): ILocalTokensAccountRecord | undefined {
    const encodedKey = encodeSnapshotSubKey(LOCAL_TOKENS_ACCT_PREFIX, rawKey);
    const entry = localTokensSnapshotCache.get(encodedKey);
    return entry?.data as ILocalTokensAccountRecord | undefined;
  }

  private readAllShardedData(): ISimpleDBLocalTokens | null {
    const keys = localTokensSnapshotCache.keys();
    if (keys.length === 0) {
      return null;
    }
    const data = this.readShardedTokenMeta();
    const tokenList: Record<string, IAccountToken[]> = {};
    const smallBalanceTokenList: Record<string, IAccountToken[]> = {};
    const riskyTokenList: Record<string, IAccountToken[]> = {};
    const tokenListMap: Record<string, Record<string, ITokenFiat>> = {};
    const tokenListValue: Record<string, string> = {};
    const tokenListCurrency: Record<string, string> = {};
    const tokenListHasAssets: Record<string, boolean> = {};
    let hasAny = Object.keys(data).length > 0;

    keys.forEach((encodedKey) => {
      if (encodedKey === LOCAL_TOKENS_META_KEY) {
        hasAny = true;
        return;
      }
      const rawKey = decodeSnapshotSubKey(LOCAL_TOKENS_ACCT_PREFIX, encodedKey);
      if (!rawKey) {
        return;
      }
      const record = localTokensSnapshotCache.get(encodedKey)?.data as
        | ILocalTokensAccountRecord
        | undefined;
      if (!record) {
        return;
      }
      hasAny = true;
      tokenList[rawKey] = record.tokenList ?? [];
      smallBalanceTokenList[rawKey] = record.smallBalanceTokenList ?? [];
      riskyTokenList[rawKey] = record.riskyTokenList ?? [];
      tokenListMap[rawKey] = record.tokenListMap ?? {};
      tokenListValue[rawKey] = record.tokenListValue ?? '0';
      if (record.currency !== undefined) {
        tokenListCurrency[rawKey] = record.currency;
      }
      if (record.hasAssets !== undefined) {
        tokenListHasAssets[rawKey] = record.hasAssets;
      }
    });

    if (!hasAny) {
      return null;
    }
    return {
      data,
      tokenList,
      smallBalanceTokenList,
      riskyTokenList,
      tokenListMap,
      tokenListValue,
      tokenListCurrency,
      tokenListHasAssets,
    };
  }

  private writeAllShardedData(
    rawData: ISimpleDBLocalTokens | null | undefined,
  ): void {
    if (!rawData) {
      localTokensSnapshotCache.clear();
      return;
    }
    const cappedMeta = this.capTokenMetadata(rawData.data);
    const allAccountKeys = new Set<string>([
      ...Object.keys(rawData.tokenList ?? {}),
      ...Object.keys(rawData.smallBalanceTokenList ?? {}),
      ...Object.keys(rawData.riskyTokenList ?? {}),
      ...Object.keys(rawData.tokenListMap ?? {}),
      ...Object.keys(rawData.tokenListValue ?? {}),
      ...Object.keys(rawData.tokenListCurrency ?? {}),
      ...Object.keys(rawData.tokenListHasAssets ?? {}),
    ]);
    const nextEncodedKeys = new Set<string>();
    const entriesToWrite: Array<readonly [string, ILocalTokensSnapshotValue]> =
      [];

    if (Object.keys(cappedMeta).length > 0) {
      nextEncodedKeys.add(LOCAL_TOKENS_META_KEY);
      entriesToWrite.push([LOCAL_TOKENS_META_KEY, cappedMeta]);
    }

    allAccountKeys.forEach((rawKey) => {
      const encodedKey = encodeSnapshotSubKey(LOCAL_TOKENS_ACCT_PREFIX, rawKey);
      nextEncodedKeys.add(encodedKey);
      const record: ILocalTokensAccountRecord = {
        tokenList: rawData.tokenList?.[rawKey] ?? [],
        smallBalanceTokenList: rawData.smallBalanceTokenList?.[rawKey] ?? [],
        riskyTokenList: rawData.riskyTokenList?.[rawKey] ?? [],
        tokenListMap: rawData.tokenListMap?.[rawKey] ?? {},
        tokenListValue: rawData.tokenListValue?.[rawKey] ?? '0',
        ...(rawData.tokenListCurrency?.[rawKey] !== undefined
          ? { currency: rawData.tokenListCurrency[rawKey] }
          : {}),
        ...(rawData.tokenListHasAssets?.[rawKey] !== undefined
          ? { hasAssets: rawData.tokenListHasAssets[rawKey] }
          : {}),
      };
      entriesToWrite.push([encodedKey, record]);
    });

    localTokensSnapshotCache.keys().forEach((existingKey) => {
      if (!nextEncodedKeys.has(existingKey)) {
        localTokensSnapshotCache.remove(existingKey);
      }
    });

    if (entriesToWrite.length > 0) {
      localTokensSnapshotCache.setMany(entriesToWrite);
    }
  }

  @backgroundMethod()
  override async getRawData(): Promise<
    ISimpleDBLocalTokens | undefined | null
  > {
    if (!this.isDefaultAppStorage()) {
      return super.getRawData();
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return undefined;
    }
    await ensureSimpleDbSnapshotNamespaceReady(LOCAL_TOKENS_SNAPSHOT_NAMESPACE);
    return this.readAllShardedData();
  }

  @backgroundMethod()
  override async setRawData(
    dataOrBuilder:
      | ISimpleDBLocalTokens
      | ((
          rawData: ISimpleDBLocalTokens | null | undefined,
        ) => ISimpleDBLocalTokens)
      | ((
          rawData: ISimpleDBLocalTokens | null | undefined,
        ) => Promise<ISimpleDBLocalTokens>),
  ): Promise<ISimpleDBLocalTokens | undefined> {
    if (!this.isDefaultAppStorage()) {
      return super.setRawData(dataOrBuilder);
    }
    return this.setRawDataWithCommitGuard(dataOrBuilder);
  }

  protected override async setRawDataWithCommitGuard(
    dataOrBuilder:
      | ISimpleDBLocalTokens
      | ((
          rawData: ISimpleDBLocalTokens | null | undefined,
        ) => ISimpleDBLocalTokens)
      | ((
          rawData: ISimpleDBLocalTokens | null | undefined,
        ) => Promise<ISimpleDBLocalTokens>),
    assertCanCommit?: () => void,
    onCommitted?: (data: ISimpleDBLocalTokens) => void,
  ): Promise<ISimpleDBLocalTokens | undefined> {
    if (!this.isDefaultAppStorage()) {
      return super.setRawDataWithCommitGuard(
        dataOrBuilder,
        assertCanCommit,
        onCommitted,
      );
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return undefined;
    }
    await ensureSimpleDbSnapshotNamespaceReady(LOCAL_TOKENS_SNAPSHOT_NAMESPACE);
    return this.mutex.runExclusive(async () => {
      assertCanCommit?.();
      let nextData: ISimpleDBLocalTokens;
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
    if (!this.isDefaultAppStorage()) {
      await super.clearRawData();
      return;
    }
    if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
      return;
    }
    await ensureSimpleDbSnapshotNamespaceReady(LOCAL_TOKENS_SNAPSHOT_NAMESPACE);
    await this.mutex.runExclusive(async () => {
      localTokensSnapshotCache.clear();
    });
  }

  // The order is taken synchronously when called, before the caller awaits.
  async reserveAccountTokenListWriteOrder(): Promise<number> {
    this.accountTokenListWriteOrder += 1;
    return this.accountTokenListWriteOrder;
  }

  // Both helpers run under the entity mutex. The order is recorded only after
  // storage accepted the write, so a failed write cannot block an older
  // response that would otherwise restore a completed snapshot.
  private isStaleAccountTokenListWrite(key: string, writeOrder: number) {
    return (
      writeOrder < (this.committedAccountTokenListWriteOrder.get(key) ?? 0)
    );
  }

  private recordAccountTokenListWriteOrder(key: string, writeOrder: number) {
    if (!this.isStaleAccountTokenListWrite(key, writeOrder)) {
      this.committedAccountTokenListWriteOrder.set(key, writeOrder);
    }
  }

  // For readers of pending caches: an entry older than the write storage has
  // already committed for its key is dropped on flush, so it is not current.
  // Only reads the committed orders, so it needs no mutex.
  async isStaleAccountTokenListCacheEntry({
    cache,
    key,
  }: {
    cache: IAccountTokenListCache;
    key: string;
  }): Promise<boolean> {
    const writeOrder = cache.tokenListWriteOrder?.[key];
    return (
      writeOrder !== undefined &&
      this.isStaleAccountTokenListWrite(key, writeOrder)
    );
  }

  // Bound the global token-metadata map. Applied on every write (here, on read it
  // re-fetches on miss) so growth is capped regardless of whether the periodic
  // orphan sweep runs. Object key order is insertion order, so the oldest entries
  // are at the front; keep the most recent LOCAL_TOKENS_METADATA_MAX_ENTRIES.
  private capTokenMetadata(
    data: Record<string, IToken> | undefined,
  ): Record<string, IToken> {
    const map = data ?? {};
    const entries = Object.entries(map);
    if (entries.length <= LOCAL_TOKENS_METADATA_MAX_ENTRIES) {
      return map;
    }
    return Object.fromEntries(
      entries.slice(entries.length - LOCAL_TOKENS_METADATA_MAX_ENTRIES),
    );
  }

  @backgroundMethod()
  async updateTokens({
    networkId,
    tokens,
  }: {
    networkId: string;
    tokens: IToken[];
  }) {
    const tokenMap = keyBy(
      tokens.map((token) => ({
        ...token,
        '$key': accountUtils.buildLocalTokenId({
          networkId,
          tokenIdOnNetwork: token.address,
        }),
      })),
      '$key',
    );

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        const currentMeta = this.readShardedTokenMeta();
        const nextMeta = this.capTokenMetadata(
          merge({}, currentMeta, tokenMap),
        );
        localTokensSnapshotCache.set(LOCAL_TOKENS_META_KEY, nextMeta);
      });
      return;
    }

    await this.setRawData((rawData) => ({
      data: this.capTokenMetadata(merge({}, rawData?.data, tokenMap)),
      tokenList: rawData?.tokenList ?? {},
      smallBalanceTokenList: rawData?.smallBalanceTokenList ?? {},
      riskyTokenList: rawData?.riskyTokenList ?? {},
      tokenListMap: rawData?.tokenListMap ?? {},
      tokenListValue: rawData?.tokenListValue ?? {},
      tokenListCurrency: rawData?.tokenListCurrency ?? {},
      tokenListHasAssets: rawData?.tokenListHasAssets ?? {},
    }));
  }

  @backgroundMethod()
  async getToken({
    networkId,
    tokenIdOnNetwork,
  }: {
    networkId: string;
    tokenIdOnNetwork: string;
  }) {
    const tokenId = accountUtils.buildLocalTokenId({
      networkId,
      tokenIdOnNetwork,
    });
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return undefined;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
      );
      const tokenMap = this.readShardedTokenMeta();
      return tokenMap[tokenId];
    }
    const tokenMap = (await this.getRawData())?.data;
    if (tokenMap) {
      const token = tokenMap[tokenId];
      if (token) {
        return token;
      }
    }
  }

  @backgroundMethod()
  async getTokens({
    networkId,
    tokenIdOnNetworkList,
  }: {
    networkId: string;
    tokenIdOnNetworkList: string[];
  }) {
    let tokenMap: Record<string, IToken> | undefined;
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return [];
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
      );
      tokenMap = this.readShardedTokenMeta();
    } else {
      tokenMap = (await this.getRawData())?.data;
    }
    if (!tokenMap) {
      return [];
    }

    return tokenIdOnNetworkList
      .map((tokenIdOnNetwork) => {
        const tokenId = accountUtils.buildLocalTokenId({
          networkId,
          tokenIdOnNetwork,
        });
        return tokenMap?.[tokenId];
      })
      .filter((token): token is IToken => !!token);
  }

  @backgroundMethod()
  async searchTokens(params: { keywords: string }): Promise<IToken[]> {
    let tokenMap: Record<string, IToken> | undefined;
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return [];
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
      );
      tokenMap = this.readShardedTokenMeta();
    } else {
      const rawData = await this.getRawData();
      tokenMap = rawData?.data;
    }

    if (!tokenMap) {
      return [];
    }

    const tokens = Object.values(tokenMap);
    const fuse = buildFuse(tokens, {
      keys: ['address'],
    });
    const result = fuse.search(params.keywords).map((i) => i.item);
    return result;
  }

  @backgroundMethod()
  async updateAccountTokenList({
    networkId,
    accountAddress,
    xpub,
    tokenList,
    smallBalanceTokenList,
    riskyTokenList,
    tokenListMap,
    tokenListValue,
    currency,
    hasAssets,
    homeRequest,
    writeOrder,
  }: {
    homeRequest?: IHomeTokenRequest;
    writeOrder?: number;
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    tokenList: IAccountToken[];
    smallBalanceTokenList: IAccountToken[];
    riskyTokenList: IAccountToken[];
    tokenListMap: Record<string, ITokenFiat>;
    tokenListValue: string;
    currency: string;
    hasAssets: boolean;
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }

    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.simpleDB__updateAccountTokenList,
      params: {
        networkId,
        accountAddress,
        xpub,
      },
    });

    perf.markStart('buildAccountLocalAssetsKey');
    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
    perf.markEnd('buildAccountLocalAssetsKey');

    const staleWriteError = new Error('Stale account token list write');
    const assertCanCommit =
      homeRequest || writeOrder !== undefined
        ? () => {
            if (homeRequest) {
              homeTokenRequestRegistry.assertCurrent(homeRequest);
            }
            if (writeOrder === undefined) {
              return;
            }
            if (this.isStaleAccountTokenListWrite(key, writeOrder)) {
              throw staleWriteError;
            }
          }
        : undefined;

    perf.markStart('setRawData');
    try {
      if (this.canUseDirectShardedAccess()) {
        if (await isSimpleDbSnapshotPersistenceAllowed()) {
          await ensureSimpleDbSnapshotNamespaceReady(
            LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
          );
          await this.mutex.runExclusive(async () => {
            assertCanCommit?.();
            const record: ILocalTokensAccountRecord = {
              tokenList,
              smallBalanceTokenList,
              riskyTokenList,
              tokenListMap,
              tokenListValue,
              currency,
              hasAssets,
            };
            localTokensSnapshotCache.set(
              encodeSnapshotSubKey(LOCAL_TOKENS_ACCT_PREFIX, key),
              record,
            );
            if (writeOrder !== undefined) {
              this.recordAccountTokenListWriteOrder(key, writeOrder);
            }
          });
        }
      } else {
        await this.setRawDataWithCommitGuard(
          (rawData) => ({
            data: rawData?.data ?? {},
            tokenList: {
              ...rawData?.tokenList,
              [key]: tokenList,
            },
            smallBalanceTokenList: {
              ...rawData?.smallBalanceTokenList,
              [key]: smallBalanceTokenList,
            },
            riskyTokenList: {
              ...rawData?.riskyTokenList,
              [key]: riskyTokenList,
            },
            tokenListMap: {
              ...rawData?.tokenListMap,
              [key]: tokenListMap,
            },
            tokenListValue: {
              ...rawData?.tokenListValue,
              [key]: tokenListValue,
            },
            tokenListCurrency: {
              ...rawData?.tokenListCurrency,
              [key]: currency,
            },
            tokenListHasAssets: {
              ...rawData?.tokenListHasAssets,
              [key]: hasAssets,
            },
          }),
          assertCanCommit,
          writeOrder === undefined
            ? undefined
            : () => this.recordAccountTokenListWriteOrder(key, writeOrder),
        );
      }
    } catch (error) {
      if (error !== staleWriteError) {
        throw error;
      }
    }
    perf.markEnd('setRawData');
    perf.done();
  }

  @backgroundMethod()
  async updateAccountTokenListByCache(
    cache: IAccountTokenListCache,
    homeRequest?: IHomeTokenRequest,
  ) {
    const assertCanCommit = homeRequest
      ? () => homeTokenRequestRegistry.assertCurrent(homeRequest)
      : undefined;

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        assertCanCommit?.();
        const tokenListCache =
          this.dropStaleAccountTokenListCacheEntries(cache);
        const batchKeys = new Set<string>([
          ...Object.keys(tokenListCache.tokenList ?? {}),
          ...Object.keys(tokenListCache.smallBalanceTokenList ?? {}),
          ...Object.keys(tokenListCache.riskyTokenList ?? {}),
          ...Object.keys(tokenListCache.tokenListMap ?? {}),
          ...Object.keys(tokenListCache.tokenListValue ?? {}),
          ...Object.keys(tokenListCache.tokenListCurrency ?? {}),
          ...Object.keys(tokenListCache.tokenListHasAssets ?? {}),
        ]);
        const entriesToWrite: Array<
          readonly [string, ILocalTokensSnapshotValue]
        > = [];
        batchKeys.forEach((rawKey) => {
          const prev = this.readShardedAccountRecord(rawKey);
          const record: ILocalTokensAccountRecord = {
            tokenList:
              tokenListCache.tokenList?.[rawKey] ?? prev?.tokenList ?? [],
            smallBalanceTokenList:
              tokenListCache.smallBalanceTokenList?.[rawKey] ??
              prev?.smallBalanceTokenList ??
              [],
            riskyTokenList:
              tokenListCache.riskyTokenList?.[rawKey] ??
              prev?.riskyTokenList ??
              [],
            tokenListMap:
              tokenListCache.tokenListMap?.[rawKey] ?? prev?.tokenListMap ?? {},
            tokenListValue:
              tokenListCache.tokenListValue?.[rawKey] ??
              prev?.tokenListValue ??
              '0',
            currency:
              tokenListCache.tokenListCurrency?.[rawKey] ?? prev?.currency,
            hasAssets:
              tokenListCache.tokenListHasAssets?.[rawKey] ?? prev?.hasAssets,
          };
          entriesToWrite.push([
            encodeSnapshotSubKey(LOCAL_TOKENS_ACCT_PREFIX, rawKey),
            record,
          ]);
        });
        if (entriesToWrite.length > 0) {
          localTokensSnapshotCache.setMany(entriesToWrite);
        }
        Object.entries(tokenListCache.tokenListWriteOrder ?? {}).forEach(
          ([key, writeOrder]) =>
            this.recordAccountTokenListWriteOrder(key, writeOrder),
        );
      });
      return;
    }

    let tokenListCache = cache;
    await this.setRawDataWithCommitGuard(
      (rawData) => {
        // Filtered under the entity mutex, like the single-key write guard.
        tokenListCache = this.dropStaleAccountTokenListCacheEntries(cache);
        return {
          data: rawData?.data ?? {},
          tokenList: {
            ...rawData?.tokenList,
            ...tokenListCache.tokenList,
          },
          smallBalanceTokenList: {
            ...rawData?.smallBalanceTokenList,
            ...tokenListCache.smallBalanceTokenList,
          },
          riskyTokenList: {
            ...rawData?.riskyTokenList,
            ...tokenListCache.riskyTokenList,
          },
          tokenListMap: {
            ...rawData?.tokenListMap,
            ...tokenListCache.tokenListMap,
          },
          tokenListValue: {
            ...rawData?.tokenListValue,
            ...tokenListCache.tokenListValue,
          },
          tokenListCurrency: {
            ...rawData?.tokenListCurrency,
            ...tokenListCache.tokenListCurrency,
          },
          tokenListHasAssets: {
            ...rawData?.tokenListHasAssets,
            ...tokenListCache.tokenListHasAssets,
          },
        };
      },
      assertCanCommit,
      () => {
        Object.entries(tokenListCache.tokenListWriteOrder ?? {}).forEach(
          ([key, writeOrder]) =>
            this.recordAccountTokenListWriteOrder(key, writeOrder),
        );
      },
    );
  }

  private dropStaleAccountTokenListCacheEntries(
    cache: IAccountTokenListCache,
  ): IAccountTokenListCache {
    const writeOrders = cache.tokenListWriteOrder;
    if (!writeOrders) {
      return cache;
    }
    const staleKeys = Object.keys(writeOrders).filter((key) =>
      this.isStaleAccountTokenListWrite(key, writeOrders[key]),
    );
    if (!staleKeys.length) {
      return cache;
    }
    return {
      tokenList: omit(cache.tokenList, staleKeys),
      smallBalanceTokenList: omit(cache.smallBalanceTokenList, staleKeys),
      riskyTokenList: omit(cache.riskyTokenList, staleKeys),
      tokenListValue: omit(cache.tokenListValue, staleKeys),
      tokenListMap: omit(cache.tokenListMap, staleKeys),
      tokenListCurrency: omit(cache.tokenListCurrency, staleKeys),
      tokenListHasAssets: omit(cache.tokenListHasAssets, staleKeys),
      tokenListWriteOrder: omit(writeOrders, staleKeys),
    };
  }

  @backgroundMethod()
  async getAccountTokenList({
    networkId,
    accountAddress,
    xpub,
    simpleDbLocalTokensRawData,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
    simpleDbLocalTokensRawData: ISimpleDBLocalTokens | null | undefined;
  }) {
    if (!accountAddress && !xpub) {
      throw new OneKeyInternalError('accountAddress or xpub is required');
    }
    const perf = perfUtils.createPerf({
      name: EPerformanceTimerLogNames.simpleDB__getAccountTokenList,
      params: {
        networkId,
        accountAddress,
        xpub,
      },
    });

    perf.markStart('buildAccountLocalAssetsKey');
    const key = accountUtils.buildAccountLocalAssetsKey({
      networkId,
      accountAddress,
      xpub,
    });
    perf.markEnd('buildAccountLocalAssetsKey');

    if (!simpleDbLocalTokensRawData && this.canUseDirectShardedAccess()) {
      perf.markStart('getRawData', {
        networkId,
        accountAddress,
        rawDataExist: false,
      });
      const allowed = await isSimpleDbSnapshotPersistenceAllowed();
      if (allowed) {
        await ensureSimpleDbSnapshotNamespaceReady(
          LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
        );
      }
      const record = allowed ? this.readShardedAccountRecord(key) : undefined;
      perf.markEnd('getRawData');
      const result = {
        tokenList: record?.tokenList ?? [],
        smallBalanceTokenList: record?.smallBalanceTokenList ?? [],
        riskyTokenList: record?.riskyTokenList ?? [],
        tokenListMap: record?.tokenListMap ?? {},
        tokenListValue: record?.tokenListValue ?? '0',
        hasCache: record !== undefined,
        currency: record?.currency,
      };
      perf.done();
      return result;
    }

    perf.markStart('getRawData', {
      networkId,
      accountAddress,
      rawDataExist: !!simpleDbLocalTokensRawData,
    });
    const rawData = simpleDbLocalTokensRawData ?? (await this.getRawData());
    perf.markEnd('getRawData');

    const result = {
      tokenList: rawData?.tokenList?.[key] ?? [],
      smallBalanceTokenList: rawData?.smallBalanceTokenList?.[key] ?? [],
      riskyTokenList: rawData?.riskyTokenList?.[key] ?? [],
      tokenListMap: rawData?.tokenListMap?.[key] ?? {},
      tokenListValue: rawData?.tokenListValue?.[key] ?? '0',
      hasCache: Object.prototype.hasOwnProperty.call(
        rawData?.tokenList ?? {},
        key,
      ),
      currency: rawData?.tokenListCurrency?.[key],
    };

    perf.done();

    return result;
  }

  @backgroundMethod()
  async removeAccountTokenList({
    networkId,
    accountAddress,
    xpub,
  }: {
    networkId: string;
    accountAddress?: string;
    xpub?: string;
  }) {
    const keys = [
      xpub ? accountUtils.buildAccountLocalAssetsKey({ networkId, xpub }) : '',
      accountAddress
        ? accountUtils.buildAccountLocalAssetsKey({ networkId, accountAddress })
        : '',
    ].filter(Boolean);
    if (keys.length === 0) return;

    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(
        LOCAL_TOKENS_SNAPSHOT_NAMESPACE,
      );
      await this.mutex.runExclusive(async () => {
        keys.forEach((rawKey) => {
          localTokensSnapshotCache.remove(
            encodeSnapshotSubKey(LOCAL_TOKENS_ACCT_PREFIX, rawKey),
          );
        });
      });
      return;
    }

    await this.setRawData((rawData) => ({
      data: rawData?.data ?? {},
      tokenList: omit(rawData?.tokenList, keys),
      smallBalanceTokenList: omit(rawData?.smallBalanceTokenList, keys),
      riskyTokenList: omit(rawData?.riskyTokenList, keys),
      tokenListMap: omit(rawData?.tokenListMap, keys),
      tokenListValue: omit(rawData?.tokenListValue, keys),
      tokenListCurrency: omit(rawData?.tokenListCurrency, keys),
      tokenListHasAssets: omit(rawData?.tokenListHasAssets, keys),
    }));
  }

  @backgroundMethod()
  async clearTokens() {
    if (this.canUseDirectShardedAccess()) {
      await this.clearRawData();
      return;
    }
    await this.setRawData({
      data: {},
      tokenList: {},
      smallBalanceTokenList: {},
      riskyTokenList: {},
      tokenListMap: {},
      tokenListValue: {},
      tokenListCurrency: {},
      tokenListHasAssets: {},
    });
  }

  // Drop cached token lists belonging to deleted accounts and cap the global
  // token-metadata map. `validOwners` is the set of lowercased addresses/xpubs of
  // all surviving accounts. Pure-cache cleanup: anything wrongly dropped just
  // re-fetches on the next refresh. See ServiceAppCleanup.cleanupOrphanedAssetCaches.
  @backgroundMethod()
  async removeOrphanData({ validOwners }: { validOwners: string[] }) {
    const existing = await this.getRawData();
    if (!existing) {
      return;
    }
    const validOwnerSet = new Set(validOwners.map((o) => o.toLowerCase()));
    const filterByOwner = <V>(
      map: Record<string, V> | undefined,
    ): Record<string, V> => {
      const result: Record<string, V> = {};
      for (const [key, value] of Object.entries(map ?? {})) {
        if (
          accountUtils.isLocalAssetsKeyOwnedBy({
            key,
            validOwners: validOwnerSet,
          })
        ) {
          result[key] = value;
        }
      }
      return result;
    };
    await this.setRawData((rawData) => {
      // Trust the in-mutex fresh value, not the pre-mutex `existing` snapshot: a
      // concurrent clearRawData ("Clear cache" calls localTokens.clearRawData)
      // nulls the store, and `?? existing` would resurrect the cleared cache.
      const base = rawData;
      return {
        // `data` is global token metadata (networkId_tokenAddress), not per
        // account; it can't be orphan-filtered, so cap total entries instead.
        data: this.capTokenMetadata(base?.data),
        tokenList: filterByOwner(base?.tokenList),
        smallBalanceTokenList: filterByOwner(base?.smallBalanceTokenList),
        riskyTokenList: filterByOwner(base?.riskyTokenList),
        tokenListMap: filterByOwner(base?.tokenListMap),
        tokenListValue: filterByOwner(base?.tokenListValue),
        tokenListCurrency: filterByOwner(base?.tokenListCurrency),
        tokenListHasAssets: filterByOwner(base?.tokenListHasAssets),
      };
    });
  }
}
