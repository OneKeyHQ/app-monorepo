import BigNumber from 'bignumber.js';

import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS,
  PERPS_ACCOUNT_DISPLAY_CACHE_WRITE_INTERVAL_MS,
  PERPS_ACCOUNT_DISPLAY_SNAPSHOT_MAX_ENTRIES,
  PERPS_ALL_DEXS_ASSET_CTXS_CACHE_WRITE_INTERVAL_MS,
  PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS,
  PERPS_L2_BOOK_SNAPSHOT_CACHE_MIN_LEVELS_PER_SIDE,
  PERPS_L2_BOOK_SNAPSHOT_CACHE_WRITE_INTERVAL_MS,
} from '@onekeyhq/shared/src/consts/perpCache';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  markPerpsColdStartPerf,
  markPerpsColdStartPerfOnce,
} from '@onekeyhq/shared/src/performance/perpsColdStartPerf';
import perpsUtils from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  getPerpsL2BookSnapshotCacheKeys,
  swrCacheUtils,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';
import type {
  IBook,
  IHex,
  IPerpsActiveAssetData,
  IWsActiveAssetCtx,
  IWsAllDexsAssetCtxs,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  perpsAbstractionModeAtom,
  perpsAccountDisplaySnapshotAtom,
  perpsActiveAccountAtom,
  perpsActiveAccountSummaryAtom,
  perpsActiveAssetAtom,
  perpsActiveAssetCtxAtom,
  perpsActiveAssetDataAtom,
  perpsComputedAccountValueAtom,
  perpsSpotBalancesAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';

import type {
  IPerpsAccountDisplayCacheSpotBalances,
  IPerpsAccountDisplayCacheSummary,
  IPerpsL2BookSnapshotCacheEntry,
} from '../../dbs/simple/entity/SimpleDbEntityPerp';
import type {
  IPerpsActiveAccountSummaryAtom,
  IPerpsActiveAssetCtxAtom,
  ISpotBalanceItem,
} from '../../states/jotai/atoms';

export type IPerpsL2BookSnapshotCachePayload = {
  coin: string;
  nSigFigs?: number | null;
  mantissa?: number | null;
  data: IBook;
};

export type IPerpsActiveAssetCtxSnapshotCacheHydration = {
  data: NonNullable<IPerpsActiveAssetCtxAtom>;
  updatedAt: number;
};

type IPerpsAccountDisplayCacheWriteType =
  | 'snapshot'
  | 'summary'
  | 'spotBalances';

export function getL2BookSnapshotLevelCount(data: IBook | undefined) {
  return Math.min(
    data?.levels?.[0]?.length ?? 0,
    data?.levels?.[1]?.length ?? 0,
  );
}

export function getL2BookSnapshotCacheEntryLevelCount(
  entry: IPerpsL2BookSnapshotCacheEntry | undefined,
) {
  return getL2BookSnapshotLevelCount(entry?.data);
}

export function isL2BookSnapshotCacheEntryComplete(
  entry: IPerpsL2BookSnapshotCacheEntry | undefined,
): entry is IPerpsL2BookSnapshotCacheEntry {
  return (
    getL2BookSnapshotCacheEntryLevelCount(entry) >=
    PERPS_L2_BOOK_SNAPSHOT_CACHE_MIN_LEVELS_PER_SIDE
  );
}

export function selectL2BookSnapshotCacheEntry({
  simpleDbEntry,
  swrEntry,
}: {
  simpleDbEntry: IPerpsL2BookSnapshotCacheEntry | undefined;
  swrEntry: IPerpsL2BookSnapshotCacheEntry | undefined;
}) {
  const candidates = [simpleDbEntry, swrEntry].filter(
    isL2BookSnapshotCacheEntryComplete,
  );
  return candidates.toSorted((a, b) => b.updatedAt - a.updatedAt)[0];
}

export function shouldWritePerpsAccountDisplayCache({
  lastWriteAt,
  now,
  minIntervalMs = PERPS_ACCOUNT_DISPLAY_CACHE_WRITE_INTERVAL_MS,
}: {
  lastWriteAt: number | undefined;
  now: number;
  minIntervalMs?: number;
}) {
  return lastWriteAt === undefined || now - lastWriteAt >= minIntervalMs;
}

export function buildL2BookSnapshotCachePayload({
  data,
  activeBookCoin,
  activeOptions,
}: {
  data: IBook;
  activeBookCoin?: string;
  activeOptions?: IL2BookOptions | null;
}): IPerpsL2BookSnapshotCachePayload | undefined {
  const coin = data?.coin;
  const hasLevels = Boolean(
    data?.levels?.[0]?.length && data?.levels?.[1]?.length,
  );
  if (!coin || !hasLevels) {
    return undefined;
  }

  const isActiveBook = activeBookCoin === coin;
  return {
    coin,
    nSigFigs: isActiveBook ? (activeOptions?.nSigFigs ?? null) : null,
    mantissa: isActiveBook ? (activeOptions?.mantissa ?? null) : null,
    data,
  };
}

function getL2BookSnapshotSwrCache({
  coin,
  nSigFigs,
  mantissa,
  maxAgeMs,
}: {
  coin: string;
  nSigFigs?: number | null;
  mantissa?: number | null;
  maxAgeMs: number;
}): IPerpsL2BookSnapshotCacheEntry | undefined {
  const keys = getPerpsL2BookSnapshotCacheKeys({
    coin,
    nSigFigs,
    mantissa,
  });
  for (const key of keys) {
    const entry = swrCacheUtils.getWithTimestamp<IBook>(key);
    if (
      entry?.data?.coin === coin &&
      Date.now() - entry.updatedAt <= maxAgeMs
    ) {
      return {
        data: entry.data,
        updatedAt: entry.updatedAt,
        nSigFigs,
        mantissa,
      };
    }
  }
  return undefined;
}

function setL2BookSnapshotSwrCache({
  coin,
  nSigFigs,
  mantissa,
  data,
}: IPerpsL2BookSnapshotCachePayload): boolean {
  try {
    const keys = getPerpsL2BookSnapshotCacheKeys({
      coin,
      nSigFigs,
      mantissa,
    });
    keys.forEach((key) => swrCacheUtils.set(key, data));
    swrCacheUtils.flushNow();
    return true;
  } catch (error) {
    defaultLogger.perp.hyperliquid.cacheSnapshotError({
      type: 'l2_book_swr',
      error,
    });
    return false;
  }
}

function getPerpsActiveAssetAvailableToTradeDisplay(
  activeAssetData: IPerpsActiveAssetData | undefined,
) {
  const available = activeAssetData?.availableToTrade;
  if (!activeAssetData?.coin || !available) {
    return undefined;
  }
  const longValue = Number(available[0] ?? 0);
  const shortValue = Number(available[1] ?? 0);
  const safeValue =
    Number.isFinite(longValue) && Number.isFinite(shortValue)
      ? Math.min(longValue, shortValue)
      : 0;
  return {
    coin: activeAssetData.coin,
    value: new BigNumber(safeValue).toFixed(2, BigNumber.ROUND_DOWN),
    updatedAt: Date.now(),
  };
}

function buildAccountDisplaySummaryCache(
  summary: IPerpsActiveAccountSummaryAtom,
): IPerpsAccountDisplayCacheSummary | undefined {
  if (!summary) {
    return undefined;
  }
  return {
    accountAddress: summary.accountAddress,
    accountValue: summary.accountValue,
    totalMarginUsed: summary.totalMarginUsed,
    crossAccountValue: summary.crossAccountValue,
    crossMaintenanceMarginUsed: summary.crossMaintenanceMarginUsed,
    totalNtlPos: summary.totalNtlPos,
    totalRawUsd: summary.totalRawUsd,
    withdrawable: summary.withdrawable,
    totalUnrealizedPnl: summary.totalUnrealizedPnl,
  };
}

@backgroundClass()
export default class ServiceHyperliquidCache extends ServiceBase {
  private _lastAllDexsAssetCtxsCacheWriteAt = 0;

  private _lastL2BookSnapshotCacheWriteAt = 0;

  private _lastAccountDisplayCacheWriteAt: Record<
    string,
    Partial<Record<IPerpsAccountDisplayCacheWriteType, number>>
  > = {};

  private _l2BookSnapshotCacheTimer: ReturnType<typeof setTimeout> | null =
    null;

  private _pendingL2BookSnapshotCache:
    | IPerpsL2BookSnapshotCachePayload
    | undefined;

  @backgroundMethod()
  async getL2BookSnapshotCache({
    coin,
    nSigFigs,
    mantissa,
  }: {
    coin: string;
    nSigFigs?: number | null;
    mantissa?: number | null;
  }): Promise<IBook | undefined> {
    markPerpsColdStartPerf('service_l2_book_cache_start', {
      coin,
      nSigFigs,
      mantissa,
    });
    const entry = await this.backgroundApi.simpleDb.perp.getL2BookSnapshotCache(
      {
        coin,
        nSigFigs,
        mantissa,
        maxAgeMs: PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS,
      },
    );
    const swrEntry = getL2BookSnapshotSwrCache({
      coin,
      nSigFigs,
      mantissa,
      maxAgeMs: PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS,
    });
    const cacheEntry = selectL2BookSnapshotCacheEntry({
      simpleDbEntry: entry,
      swrEntry,
    });
    if (!cacheEntry?.data) {
      markPerpsColdStartPerf('service_l2_book_cache_miss', {
        coin,
        simpleDbLevels: getL2BookSnapshotCacheEntryLevelCount(entry),
        swrLevels: getL2BookSnapshotCacheEntryLevelCount(swrEntry),
      });
      return undefined;
    }
    markPerpsColdStartPerf('service_l2_book_cache_hit', {
      coin,
      source: cacheEntry === entry ? 'simpleDb' : 'swr',
      ageMs: Date.now() - cacheEntry.updatedAt,
      bidLevels: cacheEntry.data.levels?.[0]?.length ?? 0,
      askLevels: cacheEntry.data.levels?.[1]?.length ?? 0,
      simpleDbLevels: getL2BookSnapshotCacheEntryLevelCount(entry),
      swrLevels: getL2BookSnapshotCacheEntryLevelCount(swrEntry),
    });
    return {
      ...cacheEntry.data,
      localReceivedAt: cacheEntry.updatedAt,
    } as IBook & { localReceivedAt?: number };
  }

  writeActiveAssetCtxSnapshotCache(data: IWsActiveAssetCtx) {
    void this.backgroundApi.simpleDb.perp
      .setActiveAssetCtxSnapshotCache(data)
      .catch((error) => {
        defaultLogger.perp.hyperliquid.cacheSnapshotError({
          type: 'active_asset_ctx_simple_db',
          error,
        });
      });
  }

  @backgroundMethod()
  async hydrateActiveAssetCtxSnapshotCache({
    coin,
  }: {
    coin: string;
  }): Promise<IPerpsActiveAssetCtxSnapshotCacheHydration | undefined> {
    markPerpsColdStartPerf('service_active_asset_ctx_cache_start', {
      coin,
    });
    const currentCtx = await perpsActiveAssetCtxAtom.get();
    const hasCurrentMarketPrice =
      currentCtx?.coin === coin &&
      [currentCtx?.ctx?.markPrice, currentCtx?.ctx?.midPrice].some(
        (price) => Number.parseFloat(price ?? '') > 0,
      );
    if (hasCurrentMarketPrice) {
      markPerpsColdStartPerf('service_active_asset_ctx_cache_skip_fresh', {
        coin,
      });
      return undefined;
    }
    const entry =
      await this.backgroundApi.simpleDb.perp.getActiveAssetCtxSnapshotCache({
        coin,
        maxAgeMs: PERPS_COLD_START_MARKET_CACHE_MAX_AGE_MS,
      });
    if (!entry?.data) {
      markPerpsColdStartPerf('service_active_asset_ctx_cache_miss', {
        coin,
      });
      return undefined;
    }
    const activeAsset = await perpsActiveAssetAtom.get();
    const displayData: NonNullable<IPerpsActiveAssetCtxAtom> = {
      coin: entry.data.coin,
      assetId:
        activeAsset?.coin === entry.data.coin ? activeAsset.assetId : undefined,
      ctx: perpsUtils.formatAssetCtx(entry.data.ctx),
    };
    markPerpsColdStartPerf('service_active_asset_ctx_cache_hit', {
      coin,
      ageMs: Date.now() - entry.updatedAt,
      markPx: entry.data.ctx?.markPx,
    });
    return {
      data: displayData,
      updatedAt: entry.updatedAt,
    };
  }

  cacheAllDexsAssetCtxsSnapshot(data: IWsAllDexsAssetCtxs) {
    const now = Date.now();
    if (
      now - this._lastAllDexsAssetCtxsCacheWriteAt <
      PERPS_ALL_DEXS_ASSET_CTXS_CACHE_WRITE_INTERVAL_MS
    ) {
      return;
    }

    const ctxCount =
      data?.ctxs?.reduce((sum, [, ctxs]) => sum + (ctxs?.length ?? 0), 0) ?? 0;
    if (ctxCount <= 0) {
      return;
    }

    this._lastAllDexsAssetCtxsCacheWriteAt = now;
    markPerpsColdStartPerfOnce(
      'service_all_dexs_asset_ctxs_cache_write_first',
      {
        dexCount: data.ctxs.length,
        ctxCount,
      },
    );
    void this.backgroundApi.simpleDb.perp
      .setAllDexsAssetCtxsSnapshotCache(data)
      .catch((error) => {
        defaultLogger.perp.hyperliquid.cacheSnapshotError({
          type: 'all_dexs_asset_ctxs_simple_db',
          error,
        });
      });
  }

  private _writeL2BookSnapshotCache(payload: IPerpsL2BookSnapshotCachePayload) {
    this._lastL2BookSnapshotCacheWriteAt = Date.now();
    const didWriteSwrCache = setL2BookSnapshotSwrCache(payload);
    markPerpsColdStartPerfOnce('service_l2_book_ws_cache_write_first', {
      coin: payload.coin,
      bidLevels: payload.data.levels?.[0]?.length ?? 0,
      askLevels: payload.data.levels?.[1]?.length ?? 0,
      nSigFigs: payload.nSigFigs,
      mantissa: payload.mantissa,
      swr: didWriteSwrCache,
    });
    void this.backgroundApi.simpleDb.perp
      .setL2BookSnapshotCache(payload)
      .catch((error) => {
        defaultLogger.perp.hyperliquid.cacheSnapshotError({
          type: 'l2_book_simple_db',
          error,
        });
      });
  }

  flushPendingL2BookSnapshotCache() {
    if (this._l2BookSnapshotCacheTimer) {
      clearTimeout(this._l2BookSnapshotCacheTimer);
      this._l2BookSnapshotCacheTimer = null;
    }
    const pending = this._pendingL2BookSnapshotCache;
    this._pendingL2BookSnapshotCache = undefined;
    if (pending) {
      this._writeL2BookSnapshotCache(pending);
    }
  }

  cacheL2BookSnapshot({
    data,
    activeBookCoin,
    activeOptions,
  }: {
    data: IBook;
    activeBookCoin?: string;
    activeOptions?: IL2BookOptions | null;
  }) {
    const payload = buildL2BookSnapshotCachePayload({
      data,
      activeBookCoin,
      activeOptions,
    });
    if (!payload) {
      return;
    }

    const now = Date.now();
    const elapsed = now - this._lastL2BookSnapshotCacheWriteAt;
    if (elapsed >= PERPS_L2_BOOK_SNAPSHOT_CACHE_WRITE_INTERVAL_MS) {
      this._pendingL2BookSnapshotCache = undefined;
      this._writeL2BookSnapshotCache(payload);
      return;
    }

    this._pendingL2BookSnapshotCache = payload;
    if (this._l2BookSnapshotCacheTimer) {
      return;
    }

    this._l2BookSnapshotCacheTimer = setTimeout(() => {
      this._l2BookSnapshotCacheTimer = null;
      const pending = this._pendingL2BookSnapshotCache;
      this._pendingL2BookSnapshotCache = undefined;
      if (pending) {
        this._writeL2BookSnapshotCache(pending);
      }
    }, PERPS_L2_BOOK_SNAPSHOT_CACHE_WRITE_INTERVAL_MS - elapsed);
  }

  private _limitPerpsAccountDisplaySnapshotEntries<
    T extends { updatedAt: number },
  >(entries: Record<string, T>): Record<string, T> {
    return Object.fromEntries(
      Object.entries(entries)
        .toSorted((a, b) => b[1].updatedAt - a[1].updatedAt)
        .slice(0, PERPS_ACCOUNT_DISPLAY_SNAPSHOT_MAX_ENTRIES),
    );
  }

  private _shouldWriteAccountDisplayCache({
    accountAddress,
    type,
  }: {
    accountAddress: string;
    type: IPerpsAccountDisplayCacheWriteType;
  }) {
    const normalized = accountAddress.toLowerCase();
    const now = Date.now();
    const writeState = this._lastAccountDisplayCacheWriteAt[normalized] ?? {};
    if (
      !shouldWritePerpsAccountDisplayCache({
        lastWriteAt: writeState[type],
        now,
      })
    ) {
      return false;
    }
    writeState[type] = now;
    this._lastAccountDisplayCacheWriteAt[normalized] = writeState;
    return true;
  }

  async writePerpsAccountDisplaySnapshot({
    accountAddress,
  }: {
    accountAddress: string;
  }) {
    const targetAddress = accountAddress.toLowerCase();
    const now = Date.now();
    const activeAccount = await perpsActiveAccountAtom.get();
    if (
      !activeAccount.accountAddress ||
      activeAccount.accountAddress.toLowerCase() !== targetAddress
    ) {
      return;
    }

    const computedValue = await perpsComputedAccountValueAtom.get();
    const activeAssetData = await perpsActiveAssetDataAtom.get();
    const availableToTrade =
      activeAssetData?.accountAddress?.toLowerCase() === targetAddress
        ? getPerpsActiveAssetAvailableToTradeDisplay(activeAssetData)
        : undefined;
    const activeAsset =
      activeAssetData?.accountAddress?.toLowerCase() === targetAddress &&
      activeAssetData.coin
        ? {
            coin: activeAssetData.coin,
            leverage: activeAssetData.leverage,
            updatedAt: now,
          }
        : undefined;
    const shouldUseComputedValue =
      computedValue?.isLoading === false &&
      computedValue.accountValue !== undefined;
    const displaySnapshot = await perpsAccountDisplaySnapshotAtom.get();
    const prevEntries = displaySnapshot?.entries ?? {};
    const prevEntry = prevEntries[targetAddress];
    const nextEntry = {
      account: activeAccount,
      accountValue: shouldUseComputedValue
        ? computedValue.accountValue
        : prevEntry?.accountValue,
      withdrawable: shouldUseComputedValue
        ? computedValue.withdrawable
        : prevEntry?.withdrawable,
      activeAsset: activeAsset ?? prevEntry?.activeAsset,
      availableToTrade: availableToTrade ?? prevEntry?.availableToTrade,
      updatedAt: now,
    };
    if (
      !nextEntry.accountValue &&
      !nextEntry.availableToTrade &&
      !nextEntry.activeAsset
    ) {
      return;
    }
    if (
      !this._shouldWriteAccountDisplayCache({
        accountAddress: targetAddress,
        type: 'snapshot',
      })
    ) {
      return;
    }

    await perpsAccountDisplaySnapshotAtom.set((prev) => {
      const latestEntries = prev?.entries ?? {};
      return {
        entries: this._limitPerpsAccountDisplaySnapshotEntries({
          ...latestEntries,
          [targetAddress]: nextEntry,
        }),
      };
    });
  }

  async hydratePerpsAccountDisplayCache(accountAddress: string) {
    const normalized = accountAddress.toLowerCase();
    const targetAddress = normalized as IHex;
    const now = Date.now();
    let summaryHit = false;
    let summaryAgeMs: number | undefined;
    let spotHit = false;
    let spotAgeMs: number | undefined;
    let abstractionHit = false;

    const cachedAbstraction =
      await this.backgroundApi.simpleDb.perp.getUserAbstractionMode(
        accountAddress,
      );
    if (cachedAbstraction) {
      abstractionHit = true;
      await perpsAbstractionModeAtom.set({
        accountAddress: targetAddress,
        mode: cachedAbstraction as EHyperLiquidAbstractionMode,
        source: 'cache',
      });
    }

    const cache =
      await this.backgroundApi.simpleDb.perp.getPerpsAccountDisplayCache(
        accountAddress,
      );

    if (cache) {
      const summary = cache.summary;
      if (
        summary?.data &&
        summary.data.accountAddress?.toLowerCase() === normalized &&
        now - summary.updatedAt <= PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS
      ) {
        summaryHit = true;
        summaryAgeMs = now - summary.updatedAt;
        await perpsActiveAccountSummaryAtom.set({
          ...summary.data,
          accountAddress: targetAddress,
        });
      }

      const spot = cache.spotBalances;
      if (
        spot?.data &&
        spot.data.accountAddress.toLowerCase() === normalized &&
        spot.data.spotTotalUsd !== undefined &&
        now - spot.updatedAt <= PERPS_ACCOUNT_DISPLAY_CACHE_MAX_AGE_MS
      ) {
        spotHit = true;
        spotAgeMs = now - spot.updatedAt;
        await perpsSpotBalancesAtom.set({
          accountAddress: targetAddress,
          balances: spot.data.balances,
          spotTotalUsd: spot.data.spotTotalUsd,
        });
      }
    }

    markPerpsColdStartPerf('service_account_display_cache_hydrate', {
      addressTail: normalized.slice(-6),
      cacheEntryExists: Boolean(cache),
      summaryHit,
      summaryAgeMs,
      spotHit,
      spotAgeMs,
      abstractionHit,
    });
  }

  async writePerpsAccountDisplaySummary(
    summary: IPerpsActiveAccountSummaryAtom,
  ) {
    const summaryAddress = summary?.accountAddress?.toLowerCase();
    const data = buildAccountDisplaySummaryCache(summary);
    if (!data || !summaryAddress) {
      return;
    }
    const activeAccount = await perpsActiveAccountAtom.get();
    if (activeAccount?.accountAddress?.toLowerCase() !== summaryAddress) {
      return;
    }
    if (
      !this._shouldWriteAccountDisplayCache({
        accountAddress: summaryAddress,
        type: 'summary',
      })
    ) {
      return;
    }
    await this.backgroundApi.simpleDb.perp.setPerpsAccountDisplaySummary({
      accountAddress: summaryAddress,
      data,
    });
  }

  async writePerpsAccountDisplaySpotBalances({
    accountAddress,
    balances,
    spotTotalUsd,
  }: {
    accountAddress: string;
    balances: ISpotBalanceItem[];
    spotTotalUsd: string;
  }) {
    const data: IPerpsAccountDisplayCacheSpotBalances = {
      accountAddress,
      balances,
      spotTotalUsd,
    };
    if (
      !this._shouldWriteAccountDisplayCache({
        accountAddress,
        type: 'spotBalances',
      })
    ) {
      return;
    }
    await this.backgroundApi.simpleDb.perp.setPerpsAccountDisplaySpotBalances({
      accountAddress,
      data,
    });
  }
}
