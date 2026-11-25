import { isFunction, omit, pick } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
} from '@onekeyhq/shared/src/consts/perp';
import {
  PERPS_ACCOUNT_DISPLAY_CACHE_MAX_ENTRIES,
  PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_ENTRIES,
  PERPS_SNAPSHOT_CACHE_MAX_ENTRIES,
} from '@onekeyhq/shared/src/consts/perpCache';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { storageHub } from '@onekeyhq/shared/src/storage/appStorage';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { IHyperliquidPortfolioSnapshot } from '@onekeyhq/shared/types/hyperliquid/portfolio';
import type {
  IBook,
  IMarginTableMap as IMarginTablesMap,
  IPerpsUniverse,
  ISpotToken,
  ISpotUniverse,
  IWsActiveAssetCtx,
  IWsAllDexsAssetCtxs,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type {
  IHyperLiquidErrorLocaleItem,
  IPerpOrderBookTickOptionPersist,
  IPerpsAssetMetaMap,
} from '@onekeyhq/shared/types/hyperliquid/types';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';
import {
  PERP_JOTAI_DISPLAY_SNAPSHOT_KEY,
  PERP_SNAPSHOT_NAMESPACE,
  decodeSnapshotSubKey,
  encodeSnapshotSubKey,
  ensureSimpleDbSnapshotNamespaceReady,
  isEntityMethodMocked,
  isSimpleDbSnapshotPersistenceAllowed,
  perpSnapshotCache,
} from '../base/simpleDbSnapshotCacheUtils';

import type { IPerpDynamicTab } from '../../../services/ServiceWebviewPerp';

export type IHyperliquidCustomSettings = {
  hideNavBar?: boolean;
  hideNavBarConnectButton?: boolean;
  hideNotOneKeyWalletConnectButton?: boolean;
  skipOrderConfirm?: boolean;
};
export type IPerpsActiveAssetCtxSnapshotCacheEntry = {
  data: IWsActiveAssetCtx;
  updatedAt: number;
};

export type IPerpsL2BookSnapshotCacheEntry = {
  data: IBook;
  updatedAt: number;
  nSigFigs?: number | null;
  mantissa?: number | null;
};

export type IPerpsAllDexsAssetCtxsSnapshotCacheEntry = {
  data: IWsAllDexsAssetCtxs;
  updatedAt: number;
};

// Per-account display cache (used only to stabilize the first frame on
// Perps cold start; never authoritative for trade permissions or risk). The
// types intentionally mirror the atom shapes structurally so the service
// layer can hydrate atoms without conversion. We keep them defined locally
// in this entity to avoid creating an import edge from simpledb to jotai
// atoms.
// Field shapes intentionally mirror the atom types: each property is
// required to be present but its value may be undefined. Don't use `?:` here
// or the structural compatibility check with IPerpsActiveAccountSummaryAtom
// breaks (TS treats optional keys as a wider type).
export interface IPerpsAccountDisplayCacheSummary {
  accountAddress: string | undefined;
  accountValue: string | undefined;
  totalMarginUsed: string | undefined;
  crossAccountValue: string | undefined;
  crossMaintenanceMarginUsed: string | undefined;
  isolatedMarginUsed: string | undefined;
  totalNtlPos: string | undefined;
  totalRawUsd: string | undefined;
  withdrawable: string | undefined;
  totalUnrealizedPnl: string | undefined;
}

export interface IPerpsAccountDisplayCacheSpotBalanceItem {
  coin: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string;
}

export interface IPerpsAccountDisplayCacheSpotBalances {
  accountAddress: string;
  balances: IPerpsAccountDisplayCacheSpotBalanceItem[];
  spotTotalUsd: string | undefined;
  hasUnsupportedBalances?: boolean;
}

export interface IPerpsAccountDisplayCacheEntry {
  accountAddress: string;
  updatedAt: number;
  summary?: {
    updatedAt: number;
    data: IPerpsAccountDisplayCacheSummary;
  };
  spotBalances?: {
    updatedAt: number;
    data: IPerpsAccountDisplayCacheSpotBalances;
  };
}

export interface IPerpsDepositTokenListCacheToken {
  networkId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  networkLogoURI: string;
  price?: string;
  balanceParsed?: string;
  fiatValue?: string;
  isNative?: boolean;
  logoURI?: string;
}

export interface IPerpsDepositTokenListCacheEntry {
  cacheKey: string;
  ownerKey?: string;
  updatedAt: number;
  tokens: IPerpsDepositTokenListCacheToken[];
  tokensByNetwork: Record<string, IPerpsDepositTokenListCacheToken[]>;
}

export interface ISimpleDbPerpData {
  hyperliquidBuilderAddress?: string;
  hyperliquidMaxBuilderFee?: number;
  hyperliquidCustomSettings?: IHyperliquidCustomSettings;
  hyperliquidCustomLocalStorage?: Record<string, any>;
  hyperliquidCustomLocalStorageV2?: Record<
    string,
    {
      value: any;
      skipIfExists?: boolean;
    }
  >;
  hyperliquidCurrentToken?: string;
  hyperliquidOrderBookTickOptions?: Record<
    string,
    IPerpOrderBookTickOptionPersist
  >;
  tradingUniverse?: IPerpsUniverse[] | undefined; // legacy single-dex
  marginTablesMap?: IMarginTablesMap; // legacy single-dex
  tradingUniverses?: IPerpsUniverse[][]; // multi-dex
  tradingUniversesUpdatedAt?: number;
  marginTablesMapList?: Array<IMarginTablesMap | undefined>;
  agentTTL?: number; // in milliseconds
  referralCode?: string;
  configVersion?: string;
  tradingviewDisplayPriceScale?: Record<string, number>; // decimal places for price display in tradingview chart
  hyperliquidTermsAccepted?: boolean;
  perpOrderOpenFlags?: Record<string, boolean>; // user address -> whether orderOpen has succeeded
  hyperliquidErrorLocales?: IHyperLiquidErrorLocaleItem[];
  dexAbstractionEnabledUsers?: Record<string, boolean>; // user address -> HIP-3 DEX abstraction enabled status
  abstractionModeUsers?: Record<string, string>; // user address -> EHyperLiquidAbstractionMode
  referralBannerSnoozedUntil?: Record<string, number>; // user address -> timestamp until which the banner is snoozed
  referralBannerCache?: Record<
    string,
    {
      shouldShow: boolean;
      reason: string;
      cachedAt: number;
    }
  >; // user address -> cached eligibility result
  tokenSearchAliases?: ITokenSearchAliases; // token search aliases from server
  tokenSelectorTabs?: IPerpDynamicTab[]; // dynamic token selector tabs from server
  perpsAssetMetaMap?: IPerpsAssetMetaMap; // perps asset metadata map from server
  spotTokens?: ISpotToken[]; // all spot tokens metadata
  spotUniverses?: ISpotUniverse[]; // spot trading pairs with resolved names
  activeAssetCtxSnapshotCache?: Record<
    string,
    IPerpsActiveAssetCtxSnapshotCacheEntry
  >;
  l2BookSnapshotCache?: Record<string, IPerpsL2BookSnapshotCacheEntry>;
  allDexsAssetCtxsSnapshotCache?: IPerpsAllDexsAssetCtxsSnapshotCacheEntry;
  // Per-account display cache keyed by normalized (lowercase) EVM address.
  // Stores last-known account value inputs so the Perps tab can render a
  // stable first frame on cold start. Trading status is intentionally not
  // cached here because status atoms are used by the order guard path.
  perpsAccountDisplayCacheByAddress?: Record<
    string,
    IPerpsAccountDisplayCacheEntry
  >;
  // Home Perps tab source; keyed by normalized (lowercase) EVM address.
  hyperliquidPortfolioSnapshotByAddress?: Record<
    string,
    IHyperliquidPortfolioSnapshot
  >;
  perpsDepositTokenListCache?: Record<string, IPerpsDepositTokenListCacheEntry>;
}

const PERP_UNIVERSE_CACHE_KEY = 'universe';
const PERP_SPOT_META_CACHE_KEY = 'spot-meta';
const PERP_ALL_DEXS_ASSET_CTXS_CACHE_KEY = 'all-dexs-asset-ctxs';
const PERP_ACTIVE_CTX_PREFIX = 'active-ctx:';
const PERP_L2_BOOK_PREFIX = 'l2-book:';
const PERP_ACCOUNT_DISPLAY_PREFIX = 'acct-display:';
const PERP_PORTFOLIO_PREFIX = 'portfolio:';
const PERP_DEPOSIT_TOKENS_PREFIX = 'deposit-tokens:';

const LEGACY_PERP_UNIVERSE_FIELDS = [
  'tradingUniverse',
  'marginTablesMap',
  'tradingUniverses',
  'tradingUniversesUpdatedAt',
  'marginTablesMapList',
] as const;
const SPLIT_PERP_CACHE_FIELDS = [
  ...LEGACY_PERP_UNIVERSE_FIELDS,
  'spotTokens',
  'spotUniverses',
  'activeAssetCtxSnapshotCache',
  'l2BookSnapshotCache',
  'allDexsAssetCtxsSnapshotCache',
  'perpsAccountDisplayCacheByAddress',
  'hyperliquidPortfolioSnapshotByAddress',
  'perpsDepositTokenListCache',
] as const;

type IPerpsUniverseCacheRecord = {
  universesByDex: IPerpsUniverse[][];
  marginTablesMapByDex: Array<IMarginTablesMap | undefined>;
  updatedAt: number;
};

type IPerpsSpotMetaCacheRecord = {
  tokens: ISpotToken[];
  universes: ISpotUniverse[];
};

const DEFAULT_APP_STORAGE =
  storageHub.$webStorageSimpleDB || storageHub.appStorage;

function hasSplitPerpCacheFields(
  data: ISimpleDbPerpData | null | undefined,
): boolean {
  if (!data) {
    return false;
  }
  return SPLIT_PERP_CACHE_FIELDS.some((field) => data[field] !== undefined);
}

export class SimpleDbEntityPerp extends SimpleDbEntityBase<ISimpleDbPerpData> {
  entityName = 'perp';

  override enableCache = true;

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
      !isEntityMethodMocked(this, 'setRawDataWithCommitGuard') &&
      !isEntityMethodMocked(this, 'getPerpData') &&
      !isEntityMethodMocked(this, 'setPerpData')
    );
  }

  private _trimShardedPrefixEntries(prefix: string, maxEntries: number): void {
    const matchingKeys = perpSnapshotCache
      .keys()
      .filter((key) => key.startsWith(prefix));
    if (matchingKeys.length <= maxEntries) {
      return;
    }
    matchingKeys
      .map((key) => {
        const entry = perpSnapshotCache.get(key);
        const data = entry?.data as
          | { fetchedAt?: number; updatedAt?: number }
          | undefined;
        return {
          key,
          timestamp:
            data?.fetchedAt ?? data?.updatedAt ?? entry?.updatedAt ?? 0,
        };
      })
      .toSorted((a, b) => b.timestamp - a.timestamp)
      .slice(maxEntries)
      .forEach(({ key }) => {
        perpSnapshotCache.remove(key);
      });
  }

  private readAllShardedPortfolioSnapshots(): Record<
    string,
    IHyperliquidPortfolioSnapshot
  > {
    const result: Record<string, IHyperliquidPortfolioSnapshot> = {};
    perpSnapshotCache.keys().forEach((encodedKey) => {
      const address = decodeSnapshotSubKey(PERP_PORTFOLIO_PREFIX, encodedKey);
      if (address === undefined) {
        return;
      }
      const entry = perpSnapshotCache.get(encodedKey)?.data as
        | IHyperliquidPortfolioSnapshot
        | undefined;
      if (entry && this._normalizePerpsAccountKey(entry.address) === address) {
        result[address] = entry;
      }
    });
    return result;
  }

  protected override async setRawDataWithCommitGuard(
    dataOrBuilder:
      | ISimpleDbPerpData
      | ((rawData: ISimpleDbPerpData | null | undefined) => ISimpleDbPerpData)
      | ((
          rawData: ISimpleDbPerpData | null | undefined,
        ) => Promise<ISimpleDbPerpData>),
    assertCanCommit?: () => void,
    onCommitted?: (data: ISimpleDbPerpData) => void,
  ): Promise<ISimpleDbPerpData | undefined> {
    if (!this.canUseDirectShardedAccess()) {
      return super.setRawDataWithCommitGuard(
        dataOrBuilder,
        assertCanCommit,
        onCommitted,
      );
    }
    return super.setRawDataWithCommitGuard(
      async (rawData) => {
        const hadSplitResidue = hasSplitPerpCacheFields(rawData);
        const strippedRawData = rawData
          ? (omit(rawData, SPLIT_PERP_CACHE_FIELDS) as ISimpleDbPerpData)
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
        const persisted = omit(
          built,
          SPLIT_PERP_CACHE_FIELDS,
        ) as ISimpleDbPerpData;
        // A preference update can precede the first partial DEX refresh.
        if (
          rawData &&
          LEGACY_PERP_UNIVERSE_FIELDS.some(
            (field) => rawData[field] !== undefined,
          ) &&
          !perpSnapshotCache.get(PERP_UNIVERSE_CACHE_KEY)
        ) {
          Object.assign(persisted, pick(rawData, LEGACY_PERP_UNIVERSE_FIELDS));
        }
        return persisted;
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
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      perpSnapshotCache.keys().forEach((key) => {
        if (key !== PERP_JOTAI_DISPLAY_SNAPSHOT_KEY) {
          perpSnapshotCache.remove(key);
        }
      });
    }
    await super.clearRawData();
  }

  private _isCacheEntryFresh(updatedAt: number | undefined, maxAgeMs: number) {
    if (!updatedAt || maxAgeMs <= 0) {
      return false;
    }
    return Date.now() - updatedAt <= maxAgeMs;
  }

  private _getL2BookSnapshotCacheKey({
    coin,
    nSigFigs,
    mantissa,
  }: {
    coin: string;
    nSigFigs?: number | null;
    mantissa?: number | null;
  }) {
    return [coin, nSigFigs ?? '', mantissa ?? ''].join(':');
  }

  private _limitSnapshotCacheEntries<T extends { updatedAt: number }>(
    entries: Record<string, T>,
    limit = PERPS_SNAPSHOT_CACHE_MAX_ENTRIES,
  ): Record<string, T> {
    return Object.fromEntries(
      Object.entries(entries)
        .toSorted((a, b) => b[1].updatedAt - a[1].updatedAt)
        .slice(0, limit),
    );
  }

  @backgroundMethod()
  async getHyperliquidTermsAccepted(): Promise<boolean> {
    const config = await this.getPerpPreferences();
    return config.hyperliquidTermsAccepted ?? false;
  }

  @backgroundMethod()
  async setHyperliquidTermsAccepted(termsAccepted: boolean) {
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        hyperliquidTermsAccepted: termsAccepted,
      }),
    );
  }

  @backgroundMethod()
  async isFirstPerpOrderOpen(userAddress: string): Promise<boolean> {
    const key = userAddress.toLowerCase();
    if (!key) {
      return true;
    }
    const config = await this.getPerpPreferences();
    return !config.perpOrderOpenFlags?.[key];
  }

  @backgroundMethod()
  async markPerpOrderOpen(userAddress: string) {
    const key = userAddress.toLowerCase();
    if (!key) {
      return;
    }
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        perpOrderOpenFlags: {
          ...prevConfig?.perpOrderOpenFlags,
          [key]: true,
        },
      }),
    );
  }

  private async getPerpPreferences(): Promise<ISimpleDbPerpData> {
    const config = await this.getRawData();
    let preferences: ISimpleDbPerpData = { ...config };
    if (!config) {
      preferences = { tradingUniverse: [] };
    } else if (this.canUseDirectShardedAccess()) {
      preferences = omit(config, SPLIT_PERP_CACHE_FIELDS);
    }
    preferences.agentTTL ??= HYPERLIQUID_AGENT_TTL_DEFAULT;
    preferences.referralCode ??= HYPERLIQUID_REFERRAL_CODE;
    preferences.hyperliquidCustomSettings ??= { skipOrderConfirm: false };
    return preferences;
  }

  @backgroundMethod()
  async getPerpData(): Promise<ISimpleDbPerpData> {
    const preferences = await this.getPerpPreferences();
    if (
      this.canUseDirectShardedAccess() &&
      (await isSimpleDbSnapshotPersistenceAllowed())
    ) {
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const portfolioSnapshots = this.readAllShardedPortfolioSnapshots();
      if (Object.keys(portfolioSnapshots).length > 0) {
        preferences.hyperliquidPortfolioSnapshotByAddress = portfolioSnapshots;
      }
    }
    return preferences;
  }

  @backgroundMethod()
  async setPerpData(
    setFn: (
      prevConfig: ISimpleDbPerpData | null | undefined,
    ) => ISimpleDbPerpData,
  ) {
    await this.setRawData(setFn);
  }

  @backgroundMethod()
  async getTradingUniverse(): Promise<{
    universesByDex: IPerpsUniverse[][];
    marginTablesMapByDex: Array<IMarginTablesMap | undefined>;
    updatedAt?: number;
  }> {
    const useSharded = this.canUseDirectShardedAccess();
    if (useSharded) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return {
          universesByDex: [],
          marginTablesMapByDex: [],
          updatedAt: undefined,
        };
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const cached = perpSnapshotCache.get(PERP_UNIVERSE_CACHE_KEY)?.data as
        | IPerpsUniverseCacheRecord
        | undefined;
      if (cached) {
        return cached;
      }
    }

    const config = useSharded
      ? await super.getRawData()
      : await this.getPerpData();
    const tradingUniverses = config?.tradingUniverses;
    let universesByDex: IPerpsUniverse[][] = [];
    if (Array.isArray(tradingUniverses) && tradingUniverses.length > 0) {
      universesByDex = !Array.isArray(tradingUniverses[0] as unknown)
        ? [tradingUniverses as unknown as IPerpsUniverse[]]
        : tradingUniverses;
    } else if (
      Array.isArray(config?.tradingUniverse) &&
      config.tradingUniverse.length > 0
    ) {
      universesByDex = [config.tradingUniverse];
    }

    let marginTablesMapByDex: Array<IMarginTablesMap | undefined> = [];
    if (
      Array.isArray(config?.marginTablesMapList) &&
      config.marginTablesMapList.length > 0
    ) {
      marginTablesMapByDex = config.marginTablesMapList;
    } else if (config?.marginTablesMap) {
      marginTablesMapByDex = [config.marginTablesMap];
    }

    return {
      universesByDex,
      marginTablesMapByDex,
      updatedAt: config?.tradingUniversesUpdatedAt,
    };
  }

  @backgroundMethod()
  async setTradingUniverse({
    universes,
    marginTablesMapList,
  }: {
    universes: IPerpsUniverse[][];
    marginTablesMapList: Array<IMarginTablesMap | undefined>;
  }) {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const record: IPerpsUniverseCacheRecord = {
        universesByDex: universes,
        marginTablesMapByDex: marginTablesMapList,
        updatedAt: Date.now(),
      };
      perpSnapshotCache.set(PERP_UNIVERSE_CACHE_KEY, record);
      return;
    }

    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        marginTablesMapList,
        marginTablesMap: marginTablesMapList?.[0],
        tradingUniverses: universes,
        tradingUniverse: universes?.[0],
        tradingUniversesUpdatedAt: Date.now(),
      }),
    );
  }

  @backgroundMethod()
  async getActiveAssetCtxSnapshotCache({
    coin,
    maxAgeMs,
  }: {
    coin: string;
    maxAgeMs: number;
  }): Promise<IPerpsActiveAssetCtxSnapshotCacheEntry | undefined> {
    if (this.canUseDirectShardedAccess()) {
      if (!coin || !(await isSimpleDbSnapshotPersistenceAllowed())) {
        return undefined;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry = perpSnapshotCache.get(
        encodeSnapshotSubKey(PERP_ACTIVE_CTX_PREFIX, coin),
      )?.data as IPerpsActiveAssetCtxSnapshotCacheEntry | undefined;
      if (!this._isCacheEntryFresh(entry?.updatedAt, maxAgeMs)) {
        return undefined;
      }
      return entry;
    }

    const config = await this.getPerpData();
    const entry = config.activeAssetCtxSnapshotCache?.[coin];
    if (!this._isCacheEntryFresh(entry?.updatedAt, maxAgeMs)) {
      return undefined;
    }
    return entry;
  }

  @backgroundMethod()
  async setActiveAssetCtxSnapshotCache(data: IWsActiveAssetCtx) {
    if (!data?.coin) {
      return;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry: IPerpsActiveAssetCtxSnapshotCacheEntry = {
        data,
        updatedAt: Date.now(),
      };
      perpSnapshotCache.set(
        encodeSnapshotSubKey(PERP_ACTIVE_CTX_PREFIX, data.coin),
        entry,
      );
      this._trimShardedPrefixEntries(
        PERP_ACTIVE_CTX_PREFIX,
        PERPS_SNAPSHOT_CACHE_MAX_ENTRIES,
      );
      return;
    }

    await this.setPerpData((prev): ISimpleDbPerpData => {
      const nextCache = {
        ...prev?.activeAssetCtxSnapshotCache,
        [data.coin]: {
          data,
          updatedAt: Date.now(),
        },
      };
      return {
        ...prev,
        activeAssetCtxSnapshotCache: this._limitSnapshotCacheEntries(nextCache),
      };
    });
  }

  @backgroundMethod()
  async getL2BookSnapshotCache({
    coin,
    nSigFigs,
    mantissa,
    maxAgeMs,
  }: {
    coin: string;
    nSigFigs?: number | null;
    mantissa?: number | null;
    maxAgeMs: number;
  }): Promise<IPerpsL2BookSnapshotCacheEntry | undefined> {
    const key = this._getL2BookSnapshotCacheKey({
      coin,
      nSigFigs,
      mantissa,
    });
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return undefined;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry = perpSnapshotCache.get(
        encodeSnapshotSubKey(PERP_L2_BOOK_PREFIX, key),
      )?.data as IPerpsL2BookSnapshotCacheEntry | undefined;
      if (!this._isCacheEntryFresh(entry?.updatedAt, maxAgeMs)) {
        return undefined;
      }
      return entry;
    }

    const config = await this.getPerpData();
    const entry = config.l2BookSnapshotCache?.[key];
    if (!this._isCacheEntryFresh(entry?.updatedAt, maxAgeMs)) {
      return undefined;
    }
    return entry;
  }

  @backgroundMethod()
  async setL2BookSnapshotCache({
    coin,
    nSigFigs,
    mantissa,
    data,
  }: {
    coin: string;
    nSigFigs?: number | null;
    mantissa?: number | null;
    data: IBook;
  }) {
    await this.setL2BookSnapshotCaches([{ coin, nSigFigs, mantissa, data }]);
  }

  @backgroundMethod()
  async setL2BookSnapshotCaches(
    snapshots: Array<{
      coin: string;
      nSigFigs?: number | null;
      mantissa?: number | null;
      data: IBook;
    }>,
  ) {
    const validSnapshots = snapshots.filter(
      (snapshot) => snapshot.coin && snapshot.data,
    );
    if (validSnapshots.length === 0) {
      return;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const updatedAt = Date.now();
      const entries = validSnapshots.map(
        ({ coin, nSigFigs, mantissa, data }) => {
          const key = this._getL2BookSnapshotCacheKey({
            coin,
            nSigFigs,
            mantissa,
          });
          const entry: IPerpsL2BookSnapshotCacheEntry = {
            data,
            updatedAt,
            nSigFigs,
            mantissa,
          };
          return [
            encodeSnapshotSubKey(PERP_L2_BOOK_PREFIX, key),
            entry,
          ] as const;
        },
      );
      perpSnapshotCache.setMany(entries);
      this._trimShardedPrefixEntries(
        PERP_L2_BOOK_PREFIX,
        PERPS_SNAPSHOT_CACHE_MAX_ENTRIES,
      );
      return;
    }

    await this.setPerpData((prev): ISimpleDbPerpData => {
      const updatedAt = Date.now();
      const nextCache = { ...prev?.l2BookSnapshotCache };
      validSnapshots.forEach(({ coin, nSigFigs, mantissa, data }) => {
        const key = this._getL2BookSnapshotCacheKey({
          coin,
          nSigFigs,
          mantissa,
        });
        nextCache[key] = {
          data,
          updatedAt,
          nSigFigs,
          mantissa,
        };
      });
      return {
        ...prev,
        l2BookSnapshotCache: this._limitSnapshotCacheEntries(nextCache),
      };
    });
  }

  @backgroundMethod()
  async getAllDexsAssetCtxsSnapshotCache({
    maxAgeMs,
  }: {
    maxAgeMs: number;
  }): Promise<IPerpsAllDexsAssetCtxsSnapshotCacheEntry | undefined> {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return undefined;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry = perpSnapshotCache.get(PERP_ALL_DEXS_ASSET_CTXS_CACHE_KEY)
        ?.data as IPerpsAllDexsAssetCtxsSnapshotCacheEntry | undefined;
      if (!this._isCacheEntryFresh(entry?.updatedAt, maxAgeMs)) {
        return undefined;
      }
      return entry;
    }

    const config = await this.getPerpData();
    const entry = config.allDexsAssetCtxsSnapshotCache;
    if (!this._isCacheEntryFresh(entry?.updatedAt, maxAgeMs)) {
      return undefined;
    }
    return entry;
  }

  @backgroundMethod()
  async setAllDexsAssetCtxsSnapshotCache(data: IWsAllDexsAssetCtxs) {
    const ctxCount =
      data?.ctxs?.reduce((sum, [, ctxs]) => sum + (ctxs?.length ?? 0), 0) ?? 0;
    if (ctxCount <= 0) {
      return;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry: IPerpsAllDexsAssetCtxsSnapshotCacheEntry = {
        data,
        updatedAt: Date.now(),
      };
      perpSnapshotCache.set(PERP_ALL_DEXS_ASSET_CTXS_CACHE_KEY, entry);
      return;
    }

    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        allDexsAssetCtxsSnapshotCache: {
          data,
          updatedAt: Date.now(),
        },
      }),
    );
  }

  @backgroundMethod()
  async getExpectBuilderAddress(): Promise<string | undefined> {
    const config = await this.getPerpPreferences();
    return config.hyperliquidBuilderAddress;
  }

  @backgroundMethod()
  async getExpectMaxBuilderFee(): Promise<number | undefined> {
    const config = await this.getPerpPreferences();
    return config.hyperliquidMaxBuilderFee;
  }

  @backgroundMethod()
  async getCurrentToken(): Promise<string> {
    const config = await this.getPerpPreferences();
    return config.hyperliquidCurrentToken || 'ETH';
  }

  @backgroundMethod()
  async setCurrentToken(token: string) {
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        hyperliquidCurrentToken: token,
      }),
    );
  }

  @backgroundMethod()
  async getPerpCustomSettings(): Promise<IHyperliquidCustomSettings> {
    const config = await this.getPerpPreferences();
    return config.hyperliquidCustomSettings ?? {};
  }

  @backgroundMethod()
  async setPerpCustomSettings(settings: IHyperliquidCustomSettings) {
    await this.setPerpData(
      (prevConfig): ISimpleDbPerpData => ({
        ...prevConfig,
        hyperliquidCustomSettings: {
          ...prevConfig?.hyperliquidCustomSettings,
          ...settings,
        },
      }),
    );
  }

  @backgroundMethod()
  async getOrderBookTickOptions(): Promise<
    Record<string, IPerpOrderBookTickOptionPersist>
  > {
    const config = await this.getPerpPreferences();
    return config.hyperliquidOrderBookTickOptions ?? {};
  }

  @backgroundMethod()
  async setOrderBookTickOption({
    symbol,
    option,
  }: {
    symbol: string;
    option: IPerpOrderBookTickOptionPersist | null;
  }) {
    await this.setPerpData((prevConfig): ISimpleDbPerpData => {
      const nextOptions = {
        ...prevConfig?.hyperliquidOrderBookTickOptions,
      };
      if (!option) {
        delete nextOptions[symbol];
      } else {
        nextOptions[symbol] = option;
      }

      return {
        ...prevConfig,
        hyperliquidOrderBookTickOptions: nextOptions,
      };
    });
  }

  async updateTradingviewDisplayPriceScale({
    symbol,
    priceScale,
  }: {
    symbol: string;
    priceScale: number;
  }) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        tradingviewDisplayPriceScale: {
          ...prev?.tradingviewDisplayPriceScale,
          [symbol]: priceScale,
        },
      }),
    );
  }

  @backgroundMethod()
  async getTradingviewDisplayPriceScale(
    symbol: string,
  ): Promise<number | undefined> {
    const config = await this.getPerpPreferences();
    return config.tradingviewDisplayPriceScale?.[symbol];
  }

  @backgroundMethod()
  async getHyperliquidErrorLocales(): Promise<
    IHyperLiquidErrorLocaleItem[] | undefined
  > {
    const config = await this.getPerpPreferences();
    return config.hyperliquidErrorLocales;
  }

  @backgroundMethod()
  async isDexAbstractionEnabled(userAddress: string): Promise<boolean> {
    const config = await this.getPerpPreferences();
    return (
      config.dexAbstractionEnabledUsers?.[userAddress.toLowerCase()] ?? false
    );
  }

  @backgroundMethod()
  async setDexAbstractionEnabled(userAddress: string, enabled: boolean) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        dexAbstractionEnabledUsers: {
          ...prev?.dexAbstractionEnabledUsers,
          [userAddress.toLowerCase()]: enabled,
        },
      }),
    );
  }

  @backgroundMethod()
  async getUserAbstractionMode(
    userAddress: string,
  ): Promise<string | undefined> {
    const config = await this.getPerpPreferences();
    const addr = userAddress.toLowerCase();
    // New field takes priority
    const mode = config.abstractionModeUsers?.[addr];
    if (mode) return mode;
    // Runtime migration: legacy boolean → dexAbstraction mode
    if (config.dexAbstractionEnabledUsers?.[addr] === true) {
      return 'dexAbstraction';
    }
    return undefined;
  }

  @backgroundMethod()
  async setUserAbstractionMode(userAddress: string, mode: string) {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        abstractionModeUsers: {
          ...prev?.abstractionModeUsers,
          [userAddress.toLowerCase()]: mode,
        },
        // Dual-write legacy field only for dexAbstraction; leave untouched for other modes
        ...(mode === 'dexAbstraction'
          ? {
              dexAbstractionEnabledUsers: {
                ...prev?.dexAbstractionEnabledUsers,
                [userAddress.toLowerCase()]: true,
              },
            }
          : {}),
      }),
    );
  }

  @backgroundMethod()
  async clearUserAbstractionMode(userAddress: string) {
    const addr = userAddress.toLowerCase();
    await this.setPerpData((prev): ISimpleDbPerpData => {
      const abstractionModeUsers = { ...prev?.abstractionModeUsers };
      delete abstractionModeUsers[addr];

      const dexAbstractionEnabledUsers = {
        ...prev?.dexAbstractionEnabledUsers,
      };
      delete dexAbstractionEnabledUsers[addr];

      return {
        ...prev,
        abstractionModeUsers,
        dexAbstractionEnabledUsers,
      };
    });
  }

  @backgroundMethod()
  async getReferralBannerSnoozedUntil(userAddress: string): Promise<number> {
    const config = await this.getPerpPreferences();
    return config.referralBannerSnoozedUntil?.[userAddress.toLowerCase()] ?? 0;
  }

  @backgroundMethod()
  async setReferralBannerSnoozedUntil(
    userAddress: string,
    snoozedUntil: number,
  ): Promise<void> {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        referralBannerSnoozedUntil: {
          ...prev?.referralBannerSnoozedUntil,
          [userAddress.toLowerCase()]: snoozedUntil,
        },
      }),
    );
  }

  @backgroundMethod()
  async getReferralBannerCache(
    userAddress: string,
  ): Promise<{ shouldShow: boolean; reason: string; cachedAt: number } | null> {
    const config = await this.getPerpPreferences();
    return config.referralBannerCache?.[userAddress.toLowerCase()] ?? null;
  }

  @backgroundMethod()
  async setReferralBannerCache(
    userAddress: string,
    cache: { shouldShow: boolean; reason: string; cachedAt: number },
  ): Promise<void> {
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        referralBannerCache: {
          ...prev?.referralBannerCache,
          [userAddress.toLowerCase()]: cache,
        },
      }),
    );
  }

  @backgroundMethod()
  async getSpotMeta(): Promise<{
    tokens: ISpotToken[];
    universes: ISpotUniverse[];
  }> {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return { tokens: [], universes: [] };
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const cached = perpSnapshotCache.get(PERP_SPOT_META_CACHE_KEY)?.data as
        | IPerpsSpotMetaCacheRecord
        | undefined;
      return {
        tokens: cached?.tokens ?? [],
        universes: cached?.universes ?? [],
      };
    }

    const config = await this.getPerpData();
    return {
      tokens: config.spotTokens || [],
      universes: config.spotUniverses || [],
    };
  }

  @backgroundMethod()
  async setSpotMeta({
    tokens,
    universes,
  }: {
    tokens: ISpotToken[];
    universes: ISpotUniverse[];
  }) {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const record: IPerpsSpotMetaCacheRecord = {
        tokens,
        universes,
      };
      perpSnapshotCache.set(PERP_SPOT_META_CACHE_KEY, record);
      return;
    }

    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        spotTokens: tokens,
        spotUniverses: universes,
      }),
    );
  }

  // Per-account display cache CRUD.

  private _normalizePerpsAccountKey(
    accountAddress: string | null | undefined,
  ): string | null {
    if (!accountAddress) {
      return null;
    }
    const trimmed = accountAddress.trim();
    if (!trimmed) {
      return null;
    }
    return trimmed.toLowerCase();
  }

  @backgroundMethod()
  async getPerpsAccountDisplayCache(
    accountAddress: string,
  ): Promise<IPerpsAccountDisplayCacheEntry | undefined> {
    const key = this._normalizePerpsAccountKey(accountAddress);
    if (!key) {
      return undefined;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return undefined;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry = perpSnapshotCache.get(
        encodeSnapshotSubKey(PERP_ACCOUNT_DISPLAY_PREFIX, key),
      )?.data as IPerpsAccountDisplayCacheEntry | undefined;
      if (
        !entry ||
        this._normalizePerpsAccountKey(entry.accountAddress) !== key
      ) {
        return undefined;
      }
      return entry;
    }

    const config = await this.getPerpData();
    const entry = config.perpsAccountDisplayCacheByAddress?.[key];
    if (!entry) {
      return undefined;
    }
    if (this._normalizePerpsAccountKey(entry.accountAddress) !== key) {
      return undefined;
    }
    return entry;
  }

  private async _upsertPerpsAccountDisplayCache(
    accountAddress: string,
    updater: (
      prev: IPerpsAccountDisplayCacheEntry,
    ) => IPerpsAccountDisplayCacheEntry,
  ) {
    const key = this._normalizePerpsAccountKey(accountAddress);
    if (!key) {
      return;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        const encodedKey = encodeSnapshotSubKey(
          PERP_ACCOUNT_DISPLAY_PREFIX,
          key,
        );
        const existing = perpSnapshotCache.get(encodedKey)?.data as
          | IPerpsAccountDisplayCacheEntry
          | undefined;
        const safeExisting: IPerpsAccountDisplayCacheEntry =
          existing &&
          this._normalizePerpsAccountKey(existing.accountAddress) === key
            ? existing
            : { accountAddress: key, updatedAt: 0 };
        const next = updater(safeExisting);
        next.accountAddress = key;
        next.updatedAt = Date.now();
        perpSnapshotCache.set(encodedKey, next);
        this._trimShardedPrefixEntries(
          PERP_ACCOUNT_DISPLAY_PREFIX,
          PERPS_ACCOUNT_DISPLAY_CACHE_MAX_ENTRIES,
        );
      });
      return;
    }

    await this.setPerpData((prev): ISimpleDbPerpData => {
      const map = { ...prev?.perpsAccountDisplayCacheByAddress };
      const existing: IPerpsAccountDisplayCacheEntry = map[key] ?? {
        accountAddress: key,
        updatedAt: 0,
      };
      const safeExisting: IPerpsAccountDisplayCacheEntry =
        this._normalizePerpsAccountKey(existing.accountAddress) === key
          ? existing
          : { accountAddress: key, updatedAt: 0 };
      const next = updater(safeExisting);
      next.accountAddress = key;
      next.updatedAt = Date.now();
      map[key] = next;
      return {
        ...prev,
        perpsAccountDisplayCacheByAddress: this._limitSnapshotCacheEntries(
          map,
          PERPS_ACCOUNT_DISPLAY_CACHE_MAX_ENTRIES,
        ),
      };
    });
  }

  @backgroundMethod()
  async setPerpsAccountDisplaySummary({
    accountAddress,
    data,
  }: {
    accountAddress: string;
    data: IPerpsAccountDisplayCacheSummary;
  }) {
    const key = this._normalizePerpsAccountKey(accountAddress);
    if (!key) {
      return;
    }
    const summaryAddr = this._normalizePerpsAccountKey(data.accountAddress);
    if (summaryAddr && summaryAddr !== key) {
      return;
    }
    await this._upsertPerpsAccountDisplayCache(key, (prev) => ({
      ...prev,
      summary: { updatedAt: Date.now(), data },
    }));
  }

  @backgroundMethod()
  async setPerpsAccountDisplaySpotBalances({
    accountAddress,
    data,
  }: {
    accountAddress: string;
    data: IPerpsAccountDisplayCacheSpotBalances;
  }) {
    const key = this._normalizePerpsAccountKey(accountAddress);
    if (!key) {
      return;
    }
    const spotAddr = this._normalizePerpsAccountKey(data.accountAddress);
    if (!spotAddr || spotAddr !== key) {
      return;
    }
    if (data.spotTotalUsd === undefined) {
      return;
    }
    await this._upsertPerpsAccountDisplayCache(key, (prev) => ({
      ...prev,
      spotBalances: { updatedAt: Date.now(), data },
    }));
  }

  @backgroundMethod()
  async clearPerpsAccountDisplayCache(accountAddress?: string) {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        if (!accountAddress) {
          perpSnapshotCache.keys().forEach((encodedKey) => {
            if (encodedKey.startsWith(PERP_ACCOUNT_DISPLAY_PREFIX)) {
              perpSnapshotCache.remove(encodedKey);
            }
          });
          return;
        }
        const key = this._normalizePerpsAccountKey(accountAddress);
        if (key) {
          perpSnapshotCache.remove(
            encodeSnapshotSubKey(PERP_ACCOUNT_DISPLAY_PREFIX, key),
          );
        }
      });
      return;
    }

    await this.setPerpData((prev): ISimpleDbPerpData => {
      if (!accountAddress) {
        return {
          ...prev,
          perpsAccountDisplayCacheByAddress: {},
        };
      }
      const key = this._normalizePerpsAccountKey(accountAddress);
      if (!key) {
        return prev ?? ({} as ISimpleDbPerpData);
      }
      const map = { ...prev?.perpsAccountDisplayCacheByAddress };
      delete map[key];
      return {
        ...prev,
        perpsAccountDisplayCacheByAddress: map,
      };
    });
  }

  @backgroundMethod()
  async getHyperliquidPortfolioSnapshot(
    address: string,
  ): Promise<IHyperliquidPortfolioSnapshot | undefined> {
    const key = this._normalizePerpsAccountKey(address);
    if (!key) {
      return undefined;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return undefined;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry = perpSnapshotCache.get(
        encodeSnapshotSubKey(PERP_PORTFOLIO_PREFIX, key),
      )?.data as IHyperliquidPortfolioSnapshot | undefined;
      if (!entry || this._normalizePerpsAccountKey(entry.address) !== key) {
        return undefined;
      }
      return entry;
    }

    const config = await this.getPerpData();
    const entry = config.hyperliquidPortfolioSnapshotByAddress?.[key];
    if (!entry || this._normalizePerpsAccountKey(entry.address) !== key) {
      return undefined;
    }
    return entry;
  }

  @backgroundMethod()
  async setHyperliquidPortfolioSnapshot(
    snapshot: IHyperliquidPortfolioSnapshot,
  ): Promise<void> {
    const key = this._normalizePerpsAccountKey(snapshot.address);
    if (!key) {
      return;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        const encodedKey = encodeSnapshotSubKey(PERP_PORTFOLIO_PREFIX, key);
        const existing = perpSnapshotCache.get(encodedKey)?.data as
          | IHyperliquidPortfolioSnapshot
          | undefined;
        if (existing && snapshot.fetchedAt <= existing.fetchedAt) {
          return;
        }
        perpSnapshotCache.set(encodedKey, { ...snapshot, address: key });
        this._trimShardedPrefixEntries(
          PERP_PORTFOLIO_PREFIX,
          PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_ENTRIES,
        );
      });
      return;
    }

    await this.setPerpData((prev): ISimpleDbPerpData => {
      const map = { ...prev?.hyperliquidPortfolioSnapshotByAddress };
      const existing = map[key];
      // Monotonic: never replace a newer snapshot with an older one.
      if (existing && snapshot.fetchedAt <= existing.fetchedAt) {
        return prev as ISimpleDbPerpData;
      }
      map[key] = { ...snapshot, address: key };
      return {
        ...prev,
        hyperliquidPortfolioSnapshotByAddress: Object.fromEntries(
          Object.entries(map)
            .toSorted((a, b) => b[1].fetchedAt - a[1].fetchedAt)
            .slice(0, PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_ENTRIES),
        ),
      };
    });
  }

  @backgroundMethod()
  async clearHyperliquidPortfolioSnapshot(address?: string): Promise<void> {
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      await this.mutex.runExclusive(async () => {
        if (!address) {
          perpSnapshotCache.keys().forEach((encodedKey) => {
            if (encodedKey.startsWith(PERP_PORTFOLIO_PREFIX)) {
              perpSnapshotCache.remove(encodedKey);
            }
          });
          return;
        }
        const key = this._normalizePerpsAccountKey(address);
        if (key) {
          perpSnapshotCache.remove(
            encodeSnapshotSubKey(PERP_PORTFOLIO_PREFIX, key),
          );
        }
      });
      return;
    }

    await this.setPerpData((prev): ISimpleDbPerpData => {
      if (!address) {
        return {
          ...prev,
          hyperliquidPortfolioSnapshotByAddress: {},
        };
      }
      const key = this._normalizePerpsAccountKey(address);
      if (!key) {
        return prev ?? ({} as ISimpleDbPerpData);
      }
      const map = { ...prev?.hyperliquidPortfolioSnapshotByAddress };
      delete map[key];
      return {
        ...prev,
        hyperliquidPortfolioSnapshotByAddress: map,
      };
    });
  }

  @backgroundMethod()
  async getPerpsDepositTokenListCache({
    cacheKey,
    maxAgeMs,
  }: {
    cacheKey: string;
    maxAgeMs: number;
  }): Promise<IPerpsDepositTokenListCacheEntry | undefined> {
    if (!cacheKey) {
      return undefined;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return undefined;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry = perpSnapshotCache.get(
        encodeSnapshotSubKey(PERP_DEPOSIT_TOKENS_PREFIX, cacheKey),
      )?.data as IPerpsDepositTokenListCacheEntry | undefined;
      if (!entry || entry.cacheKey !== cacheKey) {
        return undefined;
      }
      if (!this._isCacheEntryFresh(entry.updatedAt, maxAgeMs)) {
        return undefined;
      }
      return entry;
    }

    const config = await this.getPerpData();
    const entry = config.perpsDepositTokenListCache?.[cacheKey];
    if (!entry || entry.cacheKey !== cacheKey) {
      return undefined;
    }
    if (!this._isCacheEntryFresh(entry.updatedAt, maxAgeMs)) {
      return undefined;
    }
    return entry;
  }

  @backgroundMethod()
  async setPerpsDepositTokenListCache({
    cacheKey,
    ownerKey,
    tokens,
    tokensByNetwork,
  }: {
    cacheKey: string;
    ownerKey: string;
    tokens: IPerpsDepositTokenListCacheToken[];
    tokensByNetwork: Record<string, IPerpsDepositTokenListCacheToken[]>;
  }) {
    if (!cacheKey) {
      return;
    }
    if (this.canUseDirectShardedAccess()) {
      if (!(await isSimpleDbSnapshotPersistenceAllowed())) {
        return;
      }
      await ensureSimpleDbSnapshotNamespaceReady(PERP_SNAPSHOT_NAMESPACE);
      const entry: IPerpsDepositTokenListCacheEntry = {
        cacheKey,
        ownerKey,
        updatedAt: Date.now(),
        tokens,
        tokensByNetwork,
      };
      perpSnapshotCache.set(
        encodeSnapshotSubKey(PERP_DEPOSIT_TOKENS_PREFIX, cacheKey),
        entry,
      );
      this._trimShardedPrefixEntries(
        PERP_DEPOSIT_TOKENS_PREFIX,
        PERPS_ACCOUNT_DISPLAY_CACHE_MAX_ENTRIES,
      );
      return;
    }

    await this.setPerpData((prev): ISimpleDbPerpData => {
      const map = { ...prev?.perpsDepositTokenListCache };
      map[cacheKey] = {
        cacheKey,
        ownerKey,
        updatedAt: Date.now(),
        tokens,
        tokensByNetwork,
      };
      return {
        ...prev,
        perpsDepositTokenListCache: this._limitSnapshotCacheEntries(
          map,
          PERPS_ACCOUNT_DISPLAY_CACHE_MAX_ENTRIES,
        ),
      };
    });
  }
}
