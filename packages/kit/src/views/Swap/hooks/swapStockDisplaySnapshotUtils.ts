import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type {
  IMarketStockInfo,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockTradeSide,
  getTokenIdentityKey,
  getValidStockExecutionBalance,
} from './swapStockChannelUtils';
import { SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS } from './swapStockDisplaySnapshotConstants';

export { SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS } from './swapStockDisplaySnapshotConstants';

const SWAP_STOCK_DISPLAY_SNAPSHOT_LEGACY_VERSION = 1 as const;

export const SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION = 2 as const;
export const SWAP_STOCK_DISPLAY_DYNAMIC_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ seconds: 30 });
// The balance snapshot is presentation-only and never grants quote, Max, or
// execution readiness. Keep it only across a very recent restart; older
// balances would look authoritative even though holdings may have changed.
export const SWAP_STOCK_DISPLAY_BALANCE_MAX_AGE_MS =
  SWAP_STOCK_DISPLAY_DYNAMIC_MAX_AGE_MS;
export const SWAP_STOCK_DISPLAY_AMOUNT_MAX_AGE_MS =
  timerUtils.getTimeDurationMs({ minute: 5 });
export const SWAP_STOCK_DISPLAY_CHART_MAX_POINTS = 500;
export const SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY = 'usd' as const;

export type ISwapStockDisplayChartRange = '1D' | '1W' | '1M' | '1Y';

// Kept as the compatibility identity for existing Stock input/balance callers.
// Persisted v2 regions own their narrower identities independently.
export type ISwapStockDisplayIdentity = {
  accountKey: string;
  stockTokenKey: string;
  payTokenKey: string;
  tradeSide: ESwapStockTradeSide;
  currency: string;
  amountSessionId?: number;
};

export type ISwapStockDisplayAccountIdentity = {
  accountKey: string;
};

export type ISwapStockDisplayTokenDetailIdentity = {
  accountKey: string;
  stockTokenKey: string;
  currency: string;
};

type ISwapStockDisplayBalanceIdentity = {
  accountKey: string;
  inputTokenKey: string;
};

export type ISwapStockDisplayChartIdentity = {
  accountKey: string;
  stockTokenKey: string;
  sourceCurrency: typeof SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY;
};

export type ISwapStockDisplayAmountIdentity = {
  accountKey: string;
  stockTokenKey: string;
  payTokenKey: string;
  tradeSide: ESwapStockTradeSide;
  amountSessionId: number;
};

type ISwapStockDisplayWriteContext = ISwapStockDisplayAccountIdentity &
  Partial<Omit<ISwapStockDisplayIdentity, 'accountKey'>>;

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

export type ISwapStockDisplayTokenDescriptor = Omit<
  Pick<
    ISwapToken,
    | 'networkId'
    | 'contractAddress'
    | 'isNative'
    | 'symbol'
    | 'decimals'
    | 'name'
    | 'logoURI'
    | 'networkLogoURI'
    | 'isStock'
  >,
  'contractAddress'
> & {
  // Native-token descriptors may arrive without an address at runtime.
  contractAddress?: string;
};

export type ISwapStockDisplayBalanceSnapshot = {
  identity: ISwapStockDisplayBalanceIdentity;
  inputTokenKey: string;
  value: string;
  tokenPrice?: {
    price: string;
    currency: string;
  };
  updatedAt: number;
};

export type ISwapStockDisplayChartSnapshot = {
  identity: ISwapStockDisplayChartIdentity;
  range: ISwapStockDisplayChartRange;
  data: IMarketTokenChart;
  updatedAt: number;
};

export type ISwapStockDisplaySelectionSnapshot = {
  identity: ISwapStockDisplayAccountIdentity;
  stockToken: ISwapStockDisplayTokenDescriptor;
  payToken?: ISwapStockDisplayTokenDescriptor;
  tradeSide: ESwapStockTradeSide;
  updatedAt: number;
};

export type ISwapStockDisplayAmountSnapshot = {
  identity: ISwapStockDisplayAmountIdentity;
  value: string;
  updatedAt: number;
};

export type ISwapStockDisplaySnapshot = {
  version: typeof SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION;
  // The physical slot is account-scoped. No total pair identity gates v2.
  identity: ISwapStockDisplayAccountIdentity;
  tokenDetail?: {
    identity: ISwapStockDisplayTokenDetailIdentity;
    data: ISwapStockDisplayTokenDetail;
    updatedAt: number;
  };
  balance?: ISwapStockDisplayBalanceSnapshot;
  chart?: ISwapStockDisplayChartSnapshot;
  selection?: ISwapStockDisplaySelectionSnapshot;
  amount?: ISwapStockDisplayAmountSnapshot;
  updatedAt: number;
};

export type ISwapStockDisplaySnapshotPatch = {
  tokenDetail?: ISwapStockDisplayTokenDetail;
  balance?: Omit<ISwapStockDisplayBalanceSnapshot, 'identity' | 'updatedAt'>;
  chart?: Omit<ISwapStockDisplayChartSnapshot, 'identity' | 'updatedAt'>;
  selection?: Omit<
    ISwapStockDisplaySelectionSnapshot,
    'identity' | 'updatedAt'
  >;
  amount?: Omit<ISwapStockDisplayAmountSnapshot, 'identity' | 'updatedAt'>;
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

function buildIdentityKey(values: (string | undefined)[]) {
  if (values.some((value) => !value)) {
    return '';
  }
  return values.map((value) => encodeURIComponent(value ?? '')).join('|');
}

export function buildSwapStockDisplayIdentityKey(
  identity?: ISwapStockDisplayIdentity,
) {
  if (!identity?.tradeSide) {
    return '';
  }
  return buildIdentityKey([
    identity.accountKey,
    identity.stockTokenKey,
    identity.payTokenKey,
    identity.tradeSide,
    identity.currency?.toLowerCase(),
  ]);
}

export function buildSwapStockDisplayAccountIdentityKey(
  identity?: ISwapStockDisplayAccountIdentity,
) {
  return buildIdentityKey([identity?.accountKey]);
}

export function buildSwapStockDisplayTokenDetailIdentityKey(
  identity?: ISwapStockDisplayTokenDetailIdentity,
) {
  return buildIdentityKey([
    identity?.accountKey,
    identity?.stockTokenKey,
    identity?.currency?.toLowerCase(),
  ]);
}

function buildSwapStockDisplayBalanceIdentityKey(
  identity?: ISwapStockDisplayBalanceIdentity,
) {
  return buildIdentityKey([identity?.accountKey, identity?.inputTokenKey]);
}

export function buildSwapStockDisplayChartIdentityKey(
  identity?: ISwapStockDisplayChartIdentity,
) {
  return buildIdentityKey([
    identity?.accountKey,
    identity?.stockTokenKey,
    identity?.sourceCurrency?.toLowerCase(),
  ]);
}

export function buildSwapStockDisplayAmountIdentityKey(
  identity?: ISwapStockDisplayAmountIdentity,
) {
  if (
    !identity?.tradeSide ||
    !Number.isSafeInteger(identity.amountSessionId) ||
    identity.amountSessionId < 0
  ) {
    return '';
  }
  return buildIdentityKey([
    identity.accountKey,
    identity.stockTokenKey,
    identity.payTokenKey,
    identity.tradeSide,
    String(identity.amountSessionId),
  ]);
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

export function projectSwapStockDisplayTokenDescriptor(
  token: ISwapToken,
): ISwapStockDisplayTokenDescriptor {
  return {
    networkId: token.networkId,
    contractAddress: token.contractAddress,
    isNative: token.isNative,
    symbol: token.symbol,
    decimals: token.decimals,
    name: token.name,
    logoURI: token.logoURI,
    networkLogoURI: token.networkLogoURI,
    isStock: token.isStock,
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
    typeof value.networkId === 'string' &&
    typeof value.logoUrl === 'string' &&
    typeof value.name === 'string' &&
    typeof value.symbol === 'string' &&
    typeof value.decimals === 'number'
  );
}

function normalizeDisplayTokenDescriptor(
  value: unknown,
): ISwapStockDisplayTokenDescriptor | undefined {
  if (
    !isRecord(value) ||
    typeof value.networkId !== 'string' ||
    typeof value.symbol !== 'string' ||
    typeof value.decimals !== 'number' ||
    (typeof value.contractAddress !== 'string' &&
      !(
        value.isNative === true &&
        (value.contractAddress === undefined || value.contractAddress === null)
      ))
  ) {
    return undefined;
  }
  return {
    networkId: value.networkId,
    contractAddress:
      typeof value.contractAddress === 'string'
        ? value.contractAddress
        : undefined,
    isNative: typeof value.isNative === 'boolean' ? value.isNative : undefined,
    symbol: value.symbol,
    decimals: value.decimals,
    name: typeof value.name === 'string' ? value.name : undefined,
    logoURI: typeof value.logoURI === 'string' ? value.logoURI : undefined,
    networkLogoURI:
      typeof value.networkLogoURI === 'string'
        ? value.networkLogoURI
        : undefined,
    isStock: typeof value.isStock === 'boolean' ? value.isStock : undefined,
  };
}

function isValidChartRange(
  value: unknown,
): value is ISwapStockDisplayChartRange {
  return value === '1D' || value === '1W' || value === '1M' || value === '1Y';
}

function getValidSwapStockDisplayAmount(value: unknown) {
  if (value === '') {
    return '';
  }
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)(?:\.\d*)?$/.test(value)) {
    return undefined;
  }
  return getValidStockExecutionBalance(value);
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

function normalizeTradeSide(value: unknown) {
  return value === ESwapStockTradeSide.Buy || value === ESwapStockTradeSide.Sell
    ? value
    : undefined;
}

function normalizeLegacyIdentity(
  value: unknown,
): ISwapStockDisplayIdentity | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const tradeSide = normalizeTradeSide(value.tradeSide);
  const identity = tradeSide
    ? {
        accountKey:
          typeof value.accountKey === 'string' ? value.accountKey.trim() : '',
        stockTokenKey:
          typeof value.stockTokenKey === 'string'
            ? value.stockTokenKey.trim()
            : '',
        payTokenKey:
          typeof value.payTokenKey === 'string' ? value.payTokenKey.trim() : '',
        tradeSide,
        currency:
          typeof value.currency === 'string' ? value.currency.trim() : '',
      }
    : undefined;
  return buildSwapStockDisplayIdentityKey(identity) ? identity : undefined;
}

function normalizeTokenDetailRegion({
  accountKey,
  fallbackIdentity,
  value,
}: {
  accountKey: string;
  fallbackIdentity?: ISwapStockDisplayIdentity;
  value: unknown;
}): ISwapStockDisplaySnapshot['tokenDetail'] {
  if (!isRecord(value)) {
    return undefined;
  }
  const rawIdentity = isRecord(value.identity) ? value.identity : undefined;
  const identity: ISwapStockDisplayTokenDetailIdentity = {
    accountKey:
      typeof rawIdentity?.accountKey === 'string'
        ? rawIdentity.accountKey.trim()
        : (fallbackIdentity?.accountKey ?? ''),
    stockTokenKey:
      typeof rawIdentity?.stockTokenKey === 'string'
        ? rawIdentity.stockTokenKey.trim()
        : (fallbackIdentity?.stockTokenKey ?? ''),
    currency:
      typeof rawIdentity?.currency === 'string'
        ? rawIdentity.currency.trim().toLowerCase()
        : (fallbackIdentity?.currency.toLowerCase() ?? ''),
  };
  const updatedAt = Number(value.updatedAt);
  const data = isValidDisplayTokenDetail(value.data)
    ? projectSwapStockDisplayTokenDetail(
        value.data as unknown as IMarketTokenDetail,
      )
    : undefined;
  if (
    identity.accountKey !== accountKey ||
    !buildSwapStockDisplayTokenDetailIdentityKey(identity) ||
    !Number.isFinite(updatedAt) ||
    !data ||
    getTokenIdentityKey({
      networkId: data.networkId,
      contractAddress: data.address,
      isNative: data.isNative,
    }) !== identity.stockTokenKey
  ) {
    return undefined;
  }
  return { identity, data, updatedAt };
}

function normalizeBalanceRegion({
  accountKey,
  value,
}: {
  accountKey: string;
  value: unknown;
}): ISwapStockDisplayBalanceSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const rawIdentity = isRecord(value.identity) ? value.identity : undefined;
  const inputTokenKey =
    typeof value.inputTokenKey === 'string' ? value.inputTokenKey.trim() : '';
  const identity: ISwapStockDisplayBalanceIdentity = {
    accountKey:
      typeof rawIdentity?.accountKey === 'string'
        ? rawIdentity.accountKey.trim()
        : accountKey,
    inputTokenKey:
      typeof rawIdentity?.inputTokenKey === 'string'
        ? rawIdentity.inputTokenKey.trim()
        : inputTokenKey,
  };
  const updatedAt = Number(value.updatedAt);
  const balanceValue =
    typeof value.value === 'string'
      ? getValidStockExecutionBalance(value.value)
      : undefined;
  const tokenPrice = value.tokenPrice;
  if (
    identity.accountKey !== accountKey ||
    identity.inputTokenKey !== inputTokenKey ||
    !buildSwapStockDisplayBalanceIdentityKey(identity) ||
    balanceValue === undefined ||
    !Number.isFinite(updatedAt)
  ) {
    return undefined;
  }
  return {
    identity,
    inputTokenKey,
    value: balanceValue,
    tokenPrice:
      isRecord(tokenPrice) &&
      typeof tokenPrice.price === 'string' &&
      typeof tokenPrice.currency === 'string'
        ? { price: tokenPrice.price, currency: tokenPrice.currency }
        : undefined,
    updatedAt,
  };
}

function normalizeChartRegion({
  accountKey,
  fallbackIdentity,
  value,
}: {
  accountKey: string;
  fallbackIdentity?: ISwapStockDisplayIdentity;
  value: unknown;
}): ISwapStockDisplayChartSnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const rawIdentity = isRecord(value.identity) ? value.identity : undefined;
  const sourceCurrency =
    typeof rawIdentity?.sourceCurrency === 'string'
      ? rawIdentity.sourceCurrency.toLowerCase()
      : SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY;
  const identity: ISwapStockDisplayChartIdentity | undefined =
    sourceCurrency === SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY
      ? {
          accountKey:
            typeof rawIdentity?.accountKey === 'string'
              ? rawIdentity.accountKey.trim()
              : (fallbackIdentity?.accountKey ?? ''),
          stockTokenKey:
            typeof rawIdentity?.stockTokenKey === 'string'
              ? rawIdentity.stockTokenKey.trim()
              : (fallbackIdentity?.stockTokenKey ?? ''),
          sourceCurrency,
        }
      : undefined;
  const updatedAt = Number(value.updatedAt);
  if (
    identity?.accountKey !== accountKey ||
    !buildSwapStockDisplayChartIdentityKey(identity) ||
    !isValidChartRange(value.range) ||
    !Array.isArray(value.data) ||
    !Number.isFinite(updatedAt)
  ) {
    return undefined;
  }
  return {
    identity,
    range: value.range,
    data: sanitizeSwapStockDisplayChartData(value.data as IMarketTokenChart),
    updatedAt,
  };
}

function normalizeSelectionRegion({
  accountKey,
  value,
}: {
  accountKey: string;
  value: unknown;
}): ISwapStockDisplaySelectionSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.identity)) {
    return undefined;
  }
  const identity = {
    accountKey:
      typeof value.identity.accountKey === 'string'
        ? value.identity.accountKey.trim()
        : '',
  };
  const updatedAt = Number(value.updatedAt);
  const stockToken = normalizeDisplayTokenDescriptor(value.stockToken);
  const payToken =
    value.payToken === undefined
      ? undefined
      : normalizeDisplayTokenDescriptor(value.payToken);
  if (
    identity.accountKey !== accountKey ||
    !buildSwapStockDisplayAccountIdentityKey(identity) ||
    !stockToken ||
    (value.payToken !== undefined && !payToken) ||
    !normalizeTradeSide(value.tradeSide) ||
    !Number.isFinite(updatedAt)
  ) {
    return undefined;
  }
  return {
    identity,
    stockToken,
    payToken,
    tradeSide: value.tradeSide as ESwapStockTradeSide,
    updatedAt,
  };
}

function normalizeAmountRegion({
  accountKey,
  value,
}: {
  accountKey: string;
  value: unknown;
}): ISwapStockDisplayAmountSnapshot | undefined {
  if (!isRecord(value) || !isRecord(value.identity)) {
    return undefined;
  }
  const tradeSide = normalizeTradeSide(value.identity.tradeSide);
  const identity: ISwapStockDisplayAmountIdentity | undefined = tradeSide
    ? {
        accountKey:
          typeof value.identity.accountKey === 'string'
            ? value.identity.accountKey.trim()
            : '',
        stockTokenKey:
          typeof value.identity.stockTokenKey === 'string'
            ? value.identity.stockTokenKey.trim()
            : '',
        payTokenKey:
          typeof value.identity.payTokenKey === 'string'
            ? value.identity.payTokenKey.trim()
            : '',
        tradeSide,
        amountSessionId: Number(value.identity.amountSessionId),
      }
    : undefined;
  const updatedAt = Number(value.updatedAt);
  const amountValue = getValidSwapStockDisplayAmount(value.value);
  if (
    identity?.accountKey !== accountKey ||
    !buildSwapStockDisplayAmountIdentityKey(identity) ||
    amountValue === undefined ||
    !Number.isFinite(updatedAt)
  ) {
    return undefined;
  }
  return { identity, value: amountValue, updatedAt };
}

function normalizeSwapStockDisplaySnapshot(
  value: unknown,
): ISwapStockDisplaySnapshot | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const isLegacy = value.version === SWAP_STOCK_DISPLAY_SNAPSHOT_LEGACY_VERSION;
  if (!isLegacy && value.version !== SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION) {
    return undefined;
  }
  const legacyIdentity = isLegacy
    ? normalizeLegacyIdentity(value.identity)
    : undefined;
  const rawIdentity = isRecord(value.identity) ? value.identity : undefined;
  let accountKey = legacyIdentity?.accountKey;
  if (!isLegacy) {
    accountKey =
      typeof rawIdentity?.accountKey === 'string'
        ? rawIdentity.accountKey.trim()
        : undefined;
  }
  const updatedAt = Number(value.updatedAt);
  if (!accountKey || !Number.isFinite(updatedAt)) {
    return undefined;
  }

  const tokenDetail = normalizeTokenDetailRegion({
    accountKey,
    fallbackIdentity: legacyIdentity,
    value: value.tokenDetail,
  });
  const balance = normalizeBalanceRegion({
    accountKey,
    value: value.balance,
  });
  const chart = normalizeChartRegion({
    accountKey,
    fallbackIdentity: legacyIdentity,
    value: value.chart,
  });
  const selection = normalizeSelectionRegion({
    accountKey,
    value: value.selection,
  });
  const amount = normalizeAmountRegion({
    accountKey,
    value: value.amount,
  });
  if (!tokenDetail && !balance && !chart && !selection && !amount) {
    return undefined;
  }
  return {
    version: SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
    identity: { accountKey },
    tokenDetail,
    balance,
    chart,
    selection,
    amount,
    updatedAt,
  };
}

export function getSwapStockDisplayAccountSnapshot({
  accountKey,
  snapshot,
  maxAgeMs,
  now = Date.now(),
}: {
  accountKey?: string;
  snapshot: unknown;
  maxAgeMs?: number;
  now?: number;
}): ISwapStockDisplaySnapshot | undefined {
  const normalized = normalizeSwapStockDisplaySnapshot(snapshot);
  if (
    !accountKey ||
    !normalized ||
    normalized.identity.accountKey !== accountKey ||
    normalized.updatedAt > now
  ) {
    return undefined;
  }
  const keepFresh = <T extends { updatedAt: number }>(
    region: T | undefined,
    defaultMaxAgeMs: number,
  ) =>
    region &&
    isUsableSnapshotTimestamp({
      maxAgeMs: maxAgeMs ?? defaultMaxAgeMs,
      now,
      timestamp: region.updatedAt,
    })
      ? region
      : undefined;
  // Prices and charts are brief cold-start bridges. The exact account/token
  // balance may remain as a display-only projection; execution still requires
  // the separately scoped live balance request.
  const tokenDetail = keepFresh(
    normalized.tokenDetail,
    SWAP_STOCK_DISPLAY_DYNAMIC_MAX_AGE_MS,
  );
  const balance = keepFresh(
    normalized.balance,
    SWAP_STOCK_DISPLAY_BALANCE_MAX_AGE_MS,
  );
  const chart = keepFresh(
    normalized.chart,
    SWAP_STOCK_DISPLAY_DYNAMIC_MAX_AGE_MS,
  );
  const selection = keepFresh(
    normalized.selection,
    SWAP_STOCK_DISPLAY_SNAPSHOT_MAX_AGE_MS,
  );
  const amount = keepFresh(
    normalized.amount,
    SWAP_STOCK_DISPLAY_AMOUNT_MAX_AGE_MS,
  );
  if (!tokenDetail && !balance && !chart && !selection && !amount) {
    return undefined;
  }
  return { ...normalized, tokenDetail, balance, chart, selection, amount };
}

export function getMatchingSwapStockDisplaySnapshot({
  identity,
  snapshot,
  maxAgeMs,
  now = Date.now(),
}: {
  identity?: ISwapStockDisplayIdentity;
  snapshot: unknown;
  maxAgeMs?: number;
  now?: number;
}): ISwapStockDisplaySnapshot | undefined {
  if (!identity) {
    return undefined;
  }
  const normalized = getSwapStockDisplayAccountSnapshot({
    accountKey: identity.accountKey,
    snapshot,
    maxAgeMs,
    now,
  });
  if (!normalized) {
    return undefined;
  }
  const tokenDetailIdentity: ISwapStockDisplayTokenDetailIdentity = {
    accountKey: identity.accountKey,
    stockTokenKey: identity.stockTokenKey,
    currency: identity.currency,
  };
  const inputTokenKey =
    identity.tradeSide === ESwapStockTradeSide.Buy
      ? identity.payTokenKey
      : identity.stockTokenKey;
  const balanceIdentity: ISwapStockDisplayBalanceIdentity = {
    accountKey: identity.accountKey,
    inputTokenKey,
  };
  const chartIdentity: ISwapStockDisplayChartIdentity = {
    accountKey: identity.accountKey,
    stockTokenKey: identity.stockTokenKey,
    sourceCurrency: SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY,
  };
  const amountIdentity: ISwapStockDisplayAmountIdentity = {
    accountKey: identity.accountKey,
    stockTokenKey: identity.stockTokenKey,
    payTokenKey: identity.payTokenKey,
    tradeSide: identity.tradeSide,
    amountSessionId: identity.amountSessionId ?? 0,
  };
  const tokenDetail =
    buildSwapStockDisplayTokenDetailIdentityKey(
      normalized.tokenDetail?.identity,
    ) === buildSwapStockDisplayTokenDetailIdentityKey(tokenDetailIdentity)
      ? normalized.tokenDetail
      : undefined;
  const balance =
    buildSwapStockDisplayBalanceIdentityKey(normalized.balance?.identity) ===
    buildSwapStockDisplayBalanceIdentityKey(balanceIdentity)
      ? normalized.balance
      : undefined;
  const chart =
    buildSwapStockDisplayChartIdentityKey(normalized.chart?.identity) ===
    buildSwapStockDisplayChartIdentityKey(chartIdentity)
      ? normalized.chart
      : undefined;
  const amount =
    buildSwapStockDisplayAmountIdentityKey(normalized.amount?.identity) ===
    buildSwapStockDisplayAmountIdentityKey(amountIdentity)
      ? normalized.amount
      : undefined;
  // Selection is account-scoped and exposed through the dedicated API. Keep
  // the compatibility pair snapshot limited to exact pair-owned regions.
  const selection = undefined;
  if (!tokenDetail && !balance && !chart && !amount) {
    return undefined;
  }
  return { ...normalized, tokenDetail, balance, chart, selection, amount };
}

export function mergeSwapStockDisplaySnapshot({
  identity,
  patch,
  previous,
  now = Date.now(),
}: {
  identity: ISwapStockDisplayWriteContext;
  patch: ISwapStockDisplaySnapshotPatch;
  previous?: ISwapStockDisplaySnapshot;
  now?: number;
}): ISwapStockDisplaySnapshot {
  const usablePrevious = getSwapStockDisplayAccountSnapshot({
    accountKey: identity.accountKey,
    snapshot: previous,
    now,
  });
  const next: ISwapStockDisplaySnapshot = {
    version: SWAP_STOCK_DISPLAY_SNAPSHOT_VERSION,
    identity: { accountKey: identity.accountKey },
    tokenDetail: usablePrevious?.tokenDetail,
    balance: usablePrevious?.balance,
    chart: usablePrevious?.chart,
    selection: usablePrevious?.selection,
    amount: usablePrevious?.amount,
    updatedAt: now,
  };
  if (patch.tokenDetail && identity.stockTokenKey && identity.currency) {
    next.tokenDetail = {
      identity: {
        accountKey: identity.accountKey,
        stockTokenKey: identity.stockTokenKey,
        currency: identity.currency.toLowerCase(),
      },
      data: patch.tokenDetail,
      updatedAt: now,
    };
  }
  if (patch.balance) {
    next.balance = {
      identity: {
        accountKey: identity.accountKey,
        inputTokenKey: patch.balance.inputTokenKey,
      },
      ...patch.balance,
      updatedAt: now,
    };
  }
  if (patch.chart && identity.stockTokenKey) {
    const data = sanitizeSwapStockDisplayChartData(patch.chart.data);
    next.chart = {
      identity: {
        accountKey: identity.accountKey,
        stockTokenKey: identity.stockTokenKey,
        sourceCurrency: SWAP_STOCK_DISPLAY_CHART_SOURCE_CURRENCY,
      },
      range: patch.chart.range,
      data,
      updatedAt: now,
    };
  }
  if (patch.selection) {
    next.selection = {
      identity: { accountKey: identity.accountKey },
      stockToken: patch.selection.stockToken,
      payToken: patch.selection.payToken,
      tradeSide: patch.selection.tradeSide,
      updatedAt: now,
    };
  }
  if (
    patch.amount &&
    identity.stockTokenKey &&
    identity.payTokenKey &&
    identity.tradeSide &&
    getValidSwapStockDisplayAmount(patch.amount.value) !== undefined
  ) {
    next.amount = {
      identity: {
        accountKey: identity.accountKey,
        stockTokenKey: identity.stockTokenKey,
        payTokenKey: identity.payTokenKey,
        tradeSide: identity.tradeSide,
        amountSessionId: identity.amountSessionId ?? 0,
      },
      value: patch.amount.value,
      updatedAt: now,
    };
  }
  return next;
}
