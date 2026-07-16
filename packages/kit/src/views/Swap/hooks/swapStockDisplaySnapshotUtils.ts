import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type {
  IMarketStockInfo,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';

import {
  ESwapStockTradeSide,
  getValidStockExecutionBalance,
} from './swapStockChannelUtils';

export const SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION = 1 as const;
export const SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ week: 1 });
export const SWAP_STOCK_DISPLAY_CHART_MAX_POINTS = 500;

export type ISwapStockDisplayChartRange = '1D' | '1W' | '1M' | '1Y';

export type ISwapStockDisplayIdentity = {
  accountKey: string;
  stockTokenKey: string;
  payTokenKey: string;
  tradeSide: ESwapStockTradeSide;
  currency: string;
};

export type ISwapStockDisplayTokenDetail = Pick<
  IMarketTokenDetail,
  | 'address'
  | 'networkId'
  | 'isNative'
  | 'logoUrl'
  | 'logoUrls'
  | 'name'
  | 'symbol'
  | 'decimals'
  | 'price'
  | 'priceConverted'
  | 'priceChange24hPercent'
  | 'lastUpdated'
  | 'volume24h'
> & {
  coingeckoId?: string;
  stock?: Pick<
    IMarketStockInfo,
    | 'subtitle'
    | 'source'
    | 'sourceLogoUri'
    | 'assetAnalysis'
    | 'tradingActivity'
  >;
};

export type ISwapStockDisplayBalanceSnapshot = {
  inputTokenKey: string;
  value: string;
  tokenPrice?: {
    price: string;
    currency: string;
  };
  updatedAt: number;
};

export type ISwapStockDisplayChartSnapshot = {
  range: ISwapStockDisplayChartRange;
  data: IMarketTokenChart;
  updatedAt: number;
};

export type ISwapStockDisplaySnapshot = {
  version: typeof SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION;
  identity: ISwapStockDisplayIdentity;
  tokenDetail?: {
    data: ISwapStockDisplayTokenDetail;
    updatedAt: number;
  };
  balance?: ISwapStockDisplayBalanceSnapshot;
  chart?: ISwapStockDisplayChartSnapshot;
  updatedAt: number;
};

export type ISwapStockDisplaySnapshotPatch = {
  tokenDetail?: ISwapStockDisplayTokenDetail;
  balance?: Omit<ISwapStockDisplayBalanceSnapshot, 'updatedAt'>;
  chart?: Omit<ISwapStockDisplayChartSnapshot, 'updatedAt'>;
};

export function resolveSwapStockDisplayAccountKey({
  activeAccountCandidateKey,
  activeAccountReady,
  coldStartAccountKey,
  initialSelectedTokensSynced,
}: {
  activeAccountCandidateKey?: string;
  activeAccountReady: boolean;
  coldStartAccountKey?: string;
  initialSelectedTokensSynced: boolean;
}) {
  if (activeAccountReady) {
    return activeAccountCandidateKey;
  }
  if (initialSelectedTokensSynced) {
    return undefined;
  }
  if (
    activeAccountCandidateKey &&
    activeAccountCandidateKey !== coldStartAccountKey
  ) {
    return undefined;
  }
  return coldStartAccountKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function buildSwapStockDisplayIdentityKey(
  identity?: ISwapStockDisplayIdentity,
) {
  if (
    !identity?.accountKey ||
    !identity.stockTokenKey ||
    !identity.payTokenKey ||
    !identity.tradeSide ||
    !identity.currency
  ) {
    return '';
  }
  return [
    identity.accountKey,
    identity.stockTokenKey,
    identity.payTokenKey,
    identity.tradeSide,
    identity.currency.toLowerCase(),
  ]
    .map((value) => encodeURIComponent(value))
    .join('|');
}

export function isSwapStockDisplayIdentityMatched({
  current,
  expected,
}: {
  current?: ISwapStockDisplayIdentity;
  expected?: ISwapStockDisplayIdentity;
}) {
  return Boolean(
    current &&
    expected &&
    buildSwapStockDisplayIdentityKey(current) ===
      buildSwapStockDisplayIdentityKey(expected),
  );
}

export function projectSwapStockDisplayTokenDetail(
  tokenDetail: IMarketTokenDetail,
): ISwapStockDisplayTokenDetail {
  const coinGeckoId =
    typeof tokenDetail.coingeckoId === 'string'
      ? tokenDetail.coingeckoId.trim() || undefined
      : undefined;
  return {
    address: tokenDetail.address,
    networkId: tokenDetail.networkId,
    isNative: tokenDetail.isNative,
    logoUrl: tokenDetail.logoUrl,
    logoUrls: tokenDetail.logoUrls,
    name: tokenDetail.name,
    symbol: tokenDetail.symbol,
    decimals: tokenDetail.decimals,
    price: tokenDetail.price,
    priceConverted: tokenDetail.priceConverted,
    priceChange24hPercent: tokenDetail.priceChange24hPercent,
    lastUpdated: tokenDetail.lastUpdated,
    volume24h: tokenDetail.volume24h,
    coingeckoId: coinGeckoId,
    stock: tokenDetail.stock
      ? {
          subtitle: tokenDetail.stock.subtitle,
          source: tokenDetail.stock.source,
          sourceLogoUri: tokenDetail.stock.sourceLogoUri,
          assetAnalysis: tokenDetail.stock.assetAnalysis,
          tradingActivity: tokenDetail.stock.tradingActivity,
        }
      : undefined,
  };
}

function isValidDisplayTokenDetail(
  value: unknown,
): value is ISwapStockDisplayTokenDetail {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.address === 'string' &&
    typeof value.logoUrl === 'string' &&
    typeof value.name === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.decimals === 'number'
  );
}

function isValidChartRange(
  value: unknown,
): value is ISwapStockDisplayChartRange {
  return value === '1D' || value === '1W' || value === '1M' || value === '1Y';
}

function isValidChartPoint(value: unknown): value is IMarketTokenChart[number] {
  return Boolean(
    Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1])),
  );
}

export function sanitizeSwapStockDisplayChartData(
  data: IMarketTokenChart,
): IMarketTokenChart {
  const normalizedData: IMarketTokenChart = data
    .filter(isValidChartPoint)
    .map(([timestamp, price]): [number, number] => [
      Number(timestamp),
      Number(price),
    ]);
  if (normalizedData.length <= SWAP_STOCK_DISPLAY_CHART_MAX_POINTS) {
    return normalizedData;
  }

  const lastIndex = normalizedData.length - 1;
  return Array.from(
    { length: SWAP_STOCK_DISPLAY_CHART_MAX_POINTS },
    (_, index) =>
      normalizedData[
        Math.round(
          (index * lastIndex) / (SWAP_STOCK_DISPLAY_CHART_MAX_POINTS - 1),
        )
      ],
  );
}

function isUsableSnapshotTimestamp({
  maxAgeMs,
  now,
  timestamp,
}: {
  maxAgeMs: number;
  now: number;
  timestamp: number;
}) {
  return timestamp <= now && now - timestamp <= maxAgeMs;
}

function normalizeSwapStockDisplaySnapshot(
  value: unknown,
): ISwapStockDisplaySnapshot | undefined {
  if (
    !isRecord(value) ||
    value.version !== SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION
  ) {
    return undefined;
  }
  const identity = value.identity;
  if (!isRecord(identity)) {
    return undefined;
  }
  if (
    identity.tradeSide !== ESwapStockTradeSide.Buy &&
    identity.tradeSide !== ESwapStockTradeSide.Sell
  ) {
    return undefined;
  }
  const normalizedIdentity: ISwapStockDisplayIdentity = {
    accountKey:
      typeof identity.accountKey === 'string' ? identity.accountKey.trim() : '',
    stockTokenKey:
      typeof identity.stockTokenKey === 'string'
        ? identity.stockTokenKey.trim()
        : '',
    payTokenKey:
      typeof identity.payTokenKey === 'string'
        ? identity.payTokenKey.trim()
        : '',
    tradeSide: identity.tradeSide,
    currency:
      typeof identity.currency === 'string' ? identity.currency.trim() : '',
  };
  if (!buildSwapStockDisplayIdentityKey(normalizedIdentity)) {
    return undefined;
  }
  const updatedAt = Number(value.updatedAt);
  if (!Number.isFinite(updatedAt)) {
    return undefined;
  }

  let tokenDetail: ISwapStockDisplaySnapshot['tokenDetail'];
  if (isRecord(value.tokenDetail)) {
    const tokenUpdatedAt = Number(value.tokenDetail.updatedAt);
    if (
      Number.isFinite(tokenUpdatedAt) &&
      isValidDisplayTokenDetail(value.tokenDetail.data)
    ) {
      tokenDetail = {
        data: value.tokenDetail.data,
        updatedAt: tokenUpdatedAt,
      };
    }
  }

  let balance: ISwapStockDisplayBalanceSnapshot | undefined;
  if (isRecord(value.balance)) {
    const balanceUpdatedAt = Number(value.balance.updatedAt);
    const tokenPrice = value.balance.tokenPrice;
    const balanceValue =
      typeof value.balance.value === 'string'
        ? getValidStockExecutionBalance(value.balance.value)
        : undefined;
    if (
      typeof value.balance.inputTokenKey === 'string' &&
      balanceValue !== undefined &&
      Number.isFinite(balanceUpdatedAt)
    ) {
      balance = {
        inputTokenKey: value.balance.inputTokenKey,
        value: balanceValue,
        tokenPrice:
          isRecord(tokenPrice) &&
          typeof tokenPrice.price === 'string' &&
          typeof tokenPrice.currency === 'string'
            ? {
                price: tokenPrice.price,
                currency: tokenPrice.currency,
              }
            : undefined,
        updatedAt: balanceUpdatedAt,
      };
    }
  }

  let chart: ISwapStockDisplayChartSnapshot | undefined;
  if (isRecord(value.chart)) {
    const chartUpdatedAt = Number(value.chart.updatedAt);
    if (
      isValidChartRange(value.chart.range) &&
      Array.isArray(value.chart.data) &&
      Number.isFinite(chartUpdatedAt)
    ) {
      chart = {
        range: value.chart.range,
        data: sanitizeSwapStockDisplayChartData(
          value.chart.data as IMarketTokenChart,
        ),
        updatedAt: chartUpdatedAt,
      };
    }
  }

  if (!tokenDetail && !balance && !chart) {
    return undefined;
  }
  return {
    version: SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
    identity: normalizedIdentity,
    tokenDetail,
    balance,
    chart,
    updatedAt,
  };
}

export function getMatchingSwapStockDisplaySnapshot({
  identity,
  snapshot,
  maxAgeMs = SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS,
  now = Date.now(),
}: {
  identity?: ISwapStockDisplayIdentity;
  snapshot: unknown;
  maxAgeMs?: number;
  now?: number;
}): ISwapStockDisplaySnapshot | undefined {
  const normalized = normalizeSwapStockDisplaySnapshot(snapshot);
  if (
    !normalized ||
    !identity ||
    normalized.updatedAt > now ||
    !isSwapStockDisplayIdentityMatched({
      current: normalized.identity,
      expected: identity,
    })
  ) {
    return undefined;
  }

  const tokenDetail =
    normalized.tokenDetail &&
    isUsableSnapshotTimestamp({
      maxAgeMs,
      now,
      timestamp: normalized.tokenDetail.updatedAt,
    })
      ? normalized.tokenDetail
      : undefined;
  const balance =
    normalized.balance &&
    isUsableSnapshotTimestamp({
      maxAgeMs,
      now,
      timestamp: normalized.balance.updatedAt,
    })
      ? normalized.balance
      : undefined;
  const chart =
    normalized.chart &&
    isUsableSnapshotTimestamp({
      maxAgeMs,
      now,
      timestamp: normalized.chart.updatedAt,
    })
      ? normalized.chart
      : undefined;
  if (!tokenDetail && !balance && !chart) {
    return undefined;
  }
  return {
    ...normalized,
    tokenDetail,
    balance,
    chart,
  };
}

export function mergeSwapStockDisplaySnapshot({
  identity,
  patch,
  previous,
  now = Date.now(),
}: {
  identity: ISwapStockDisplayIdentity;
  patch: ISwapStockDisplaySnapshotPatch;
  previous?: ISwapStockDisplaySnapshot;
  now?: number;
}): ISwapStockDisplaySnapshot {
  const usablePrevious = getMatchingSwapStockDisplaySnapshot({
    identity,
    snapshot: previous,
    now,
  });
  const next: ISwapStockDisplaySnapshot = {
    version: SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
    identity,
    tokenDetail: usablePrevious?.tokenDetail,
    balance: usablePrevious?.balance,
    chart: usablePrevious?.chart,
    updatedAt: now,
  };
  if (patch.tokenDetail) {
    next.tokenDetail = {
      data: patch.tokenDetail,
      updatedAt: now,
    };
  }
  if (patch.balance) {
    next.balance = {
      ...patch.balance,
      updatedAt: now,
    };
  }
  if (patch.chart) {
    next.chart = {
      range: patch.chart.range,
      data: sanitizeSwapStockDisplayChartData(patch.chart.data),
      updatedAt: now,
    };
  }
  return next;
}
