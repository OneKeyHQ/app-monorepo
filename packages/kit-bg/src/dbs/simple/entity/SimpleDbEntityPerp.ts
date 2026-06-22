import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  HYPERLIQUID_AGENT_TTL_DEFAULT,
  HYPERLIQUID_REFERRAL_CODE,
} from '@onekeyhq/shared/src/consts/perp';
import {
  PERPS_ACCOUNT_DISPLAY_CACHE_MAX_ENTRIES,
  PERPS_SNAPSHOT_CACHE_MAX_ENTRIES,
} from '@onekeyhq/shared/src/consts/perpCache';
import type { ITokenSearchAliases } from '@onekeyhq/shared/src/utils/perpsUtils';
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
}

export class SimpleDbEntityPerp extends SimpleDbEntityBase<ISimpleDbPerpData> {
  entityName = 'perp';

  override enableCache = true;

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
    const config = await this.getPerpData();
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
    const config = await this.getPerpData();
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

  @backgroundMethod()
  async getPerpData(): Promise<ISimpleDbPerpData> {
    const config = await this.getRawData();
    const result = config || {
      tradingUniverse: [],
    };
    result.agentTTL = result.agentTTL ?? HYPERLIQUID_AGENT_TTL_DEFAULT;
    result.referralCode = result.referralCode ?? HYPERLIQUID_REFERRAL_CODE;
    result.hyperliquidCustomSettings = result.hyperliquidCustomSettings ?? {
      skipOrderConfirm: false,
    };
    return result;
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
  }> {
    const config = await this.getPerpData();
    const tradingUniverses = config.tradingUniverses;
    let universesByDex: IPerpsUniverse[][] = [];
    if (Array.isArray(tradingUniverses) && tradingUniverses.length > 0) {
      universesByDex = !Array.isArray(tradingUniverses[0] as unknown)
        ? [tradingUniverses as unknown as IPerpsUniverse[]]
        : tradingUniverses;
    } else if (
      Array.isArray(config.tradingUniverse) &&
      config.tradingUniverse.length > 0
    ) {
      universesByDex = [config.tradingUniverse];
    }

    let marginTablesMapByDex: Array<IMarginTablesMap | undefined> = [];
    if (
      Array.isArray(config.marginTablesMapList) &&
      config.marginTablesMapList.length > 0
    ) {
      marginTablesMapByDex = config.marginTablesMapList;
    } else if (config.marginTablesMap) {
      marginTablesMapByDex = [config.marginTablesMap];
    }

    return {
      universesByDex,
      marginTablesMapByDex,
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
    await this.setPerpData(
      (prev): ISimpleDbPerpData => ({
        ...prev,
        marginTablesMapList,
        marginTablesMap: marginTablesMapList?.[0],
        tradingUniverses: universes,
        tradingUniverse: universes?.[0],
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
    const config = await this.getPerpData();
    const key = this._getL2BookSnapshotCacheKey({
      coin,
      nSigFigs,
      mantissa,
    });
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
    if (!coin || !data) {
      return;
    }
    await this.setPerpData((prev): ISimpleDbPerpData => {
      const key = this._getL2BookSnapshotCacheKey({
        coin,
        nSigFigs,
        mantissa,
      });
      const nextCache = {
        ...prev?.l2BookSnapshotCache,
        [key]: {
          data,
          updatedAt: Date.now(),
          nSigFigs,
          mantissa,
        },
      };
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
    const config = await this.getPerpData();
    return config.hyperliquidBuilderAddress;
  }

  @backgroundMethod()
  async getExpectMaxBuilderFee(): Promise<number | undefined> {
    const config = await this.getPerpData();
    return config.hyperliquidMaxBuilderFee;
  }

  @backgroundMethod()
  async getCurrentToken(): Promise<string> {
    const config = await this.getPerpData();
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
    const config = await this.getPerpData();
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
    const config = await this.getPerpData();
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
        tradingUniverse: prev?.tradingUniverse,
        marginTablesMap: prev?.marginTablesMap,
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
    const config = await this.getPerpData();
    return config.tradingviewDisplayPriceScale?.[symbol];
  }

  @backgroundMethod()
  async getHyperliquidErrorLocales(): Promise<
    IHyperLiquidErrorLocaleItem[] | undefined
  > {
    const config = await this.getPerpData();
    return config.hyperliquidErrorLocales;
  }

  @backgroundMethod()
  async isDexAbstractionEnabled(userAddress: string): Promise<boolean> {
    const config = await this.getPerpData();
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
    const config = await this.getPerpData();
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
    const config = await this.getPerpData();
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
    const config = await this.getPerpData();
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
    const config = await this.getPerpData();
    const entry = config.perpsAccountDisplayCacheByAddress?.[key];
    if (!entry) {
      return undefined;
    }
    // Defensive: ignore cache entries that don't match the requested address
    // (should be impossible since the key is the address, but guards against
    // corrupted data).
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
    await this.setPerpData((prev): ISimpleDbPerpData => {
      const map = { ...prev?.perpsAccountDisplayCacheByAddress };
      const existing: IPerpsAccountDisplayCacheEntry = map[key] ?? {
        accountAddress: key,
        updatedAt: 0,
      };
      // Guard against a corrupted entry whose stored address drifted away
      // from its key; rebuild from scratch in that case.
      const safeExisting: IPerpsAccountDisplayCacheEntry =
        this._normalizePerpsAccountKey(existing.accountAddress) === key
          ? existing
          : { accountAddress: key, updatedAt: 0 };
      const next = updater(safeExisting);
      // Force the stored address to match the key so consumers can rely on it.
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
    // Refuse to persist a summary whose own address disagrees with the cache
    // key; otherwise stale WS frames could poison the wrong account.
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
    // Don't persist a half-loaded snapshot. spotTotalUsd undefined means the
    // mids aren't ready yet and using it would re-introduce the unknown-as-
    // empty flicker.
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
}
