import BigNumber from 'bignumber.js';

import { EHyperLiquidAbstractionMode } from '../../types/hyperliquid/types';
import {
  PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
  PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_AGE_MS,
} from '../consts/perpCache';

import {
  calculateSpotBalancesTotalUsd,
  isHyperliquidSpotStableCoin,
} from './perpsUtils';

import type {
  IHyperliquidPerpPositionSnapshot,
  IHyperliquidPortfolioSnapshot,
  IHyperliquidSpotBalanceSnapshot,
} from '../../types/hyperliquid/portfolio';
import type {
  IClearinghouseStateResponse,
  ISpotClearinghouseStateResponse,
  ISpotMetaAndAssetCtxsResponse,
} from '../../types/hyperliquid/sdk';

const USDC = 'USDC';
const CLEARINGHOUSE_SUMMARY_FIELDS = [
  'accountValue',
  'totalNtlPos',
  'totalRawUsd',
  'totalMarginUsed',
] as const;

type IClearinghouseSummary = IClearinghouseStateResponse['marginSummary'];
type IPerpAssetPosition = IClearinghouseStateResponse['assetPositions'][number];
type ISpotBalance = ISpotClearinghouseStateResponse['balances'][number];

export interface IAggregateClearinghouseStateInput {
  dex?: string;
  state: IClearinghouseStateResponse | undefined | null;
}

function safeBN(v: string | number | undefined | null): BigNumber {
  const bn = new BigNumber(v ?? 0);
  return bn.isFinite() ? bn : new BigNumber(0);
}

function createEmptyClearinghouseSummary(): IClearinghouseSummary {
  return {
    accountValue: '0',
    totalNtlPos: '0',
    totalRawUsd: '0',
    totalMarginUsed: '0',
  };
}

function addClearinghouseSummary(
  target: IClearinghouseSummary,
  source: IClearinghouseSummary | undefined,
) {
  CLEARINGHOUSE_SUMMARY_FIELDS.forEach((field) => {
    target[field] = safeBN(target[field])
      .plus(safeBN(source?.[field]))
      .toFixed();
  });
}

function getDexPrefixedCoin(coin: string, dex: string | undefined): string {
  const normalizedDex = dex?.trim();
  if (!normalizedDex || coin.includes(':')) {
    return coin;
  }
  return `${normalizedDex}:${coin}`;
}

export function aggregateClearinghouseStates(
  inputs: IAggregateClearinghouseStateInput[],
): IClearinghouseStateResponse | undefined {
  if (inputs.length === 0) {
    return undefined;
  }

  const validInputs = inputs.filter(
    (
      input,
    ): input is {
      dex?: string;
      state: IClearinghouseStateResponse;
    } => Boolean(input.state),
  );
  if (validInputs.length === 0) {
    return undefined;
  }

  const marginSummary = createEmptyClearinghouseSummary();
  const crossMarginSummary = createEmptyClearinghouseSummary();
  const assetPositions: IClearinghouseStateResponse['assetPositions'] = [];
  let crossMaintenanceMarginUsed = new BigNumber(0);
  let withdrawable = new BigNumber(0);
  let time = 0;

  validInputs.forEach(({ dex, state }) => {
    addClearinghouseSummary(marginSummary, state.marginSummary);
    addClearinghouseSummary(crossMarginSummary, state.crossMarginSummary);
    crossMaintenanceMarginUsed = crossMaintenanceMarginUsed.plus(
      safeBN(state.crossMaintenanceMarginUsed),
    );
    withdrawable = withdrawable.plus(safeBN(state.withdrawable));
    time = Math.max(time, state.time ?? 0);

    assetPositions.push(
      ...(state.assetPositions ?? []).map((assetPosition) => {
        const coin = assetPosition.position.coin;
        const prefixedCoin = getDexPrefixedCoin(coin, dex);
        if (prefixedCoin === coin) {
          return assetPosition;
        }
        return {
          ...assetPosition,
          position: {
            ...assetPosition.position,
            coin: prefixedCoin,
          },
        };
      }),
    );
  });

  return {
    ...validInputs[0].state,
    marginSummary,
    crossMarginSummary,
    crossMaintenanceMarginUsed: crossMaintenanceMarginUsed.toFixed(),
    withdrawable: withdrawable.toFixed(),
    assetPositions,
    time,
  };
}

export function buildSpotPriceMap(
  metaAndCtxs: ISpotMetaAndAssetCtxsResponse,
): Record<string, string> {
  const [meta, ctxs] = metaAndCtxs ?? [];
  const priceMap: Record<string, string> = { [USDC]: '1' };
  if (!meta?.universe || !meta?.tokens || !Array.isArray(ctxs)) return priceMap;
  const tokenByIndex = new Map(meta.tokens.map((t) => [t.index, t]));
  const ctxByCoin = new Map(ctxs.map((c) => [c.coin, c]));
  meta.universe.forEach((uni) => {
    const baseToken = tokenByIndex.get(uni.tokens[0]);
    const quoteToken = tokenByIndex.get(uni.tokens[1]);
    const baseName = baseToken?.name;
    if (!baseName || baseName === USDC) return;
    const px = ctxByCoin.get(uni.name)?.markPx;
    if (!px || !new BigNumber(px).isFinite() || new BigNumber(px).lte(0))
      return;
    // Token/token markPx is quote-token denominated, so only store USD prices.
    if (quoteToken?.name !== USDC) return;
    priceMap[baseName] = px;
  });
  return priceMap;
}

export function spotBalancesNeedPriceRefresh(
  spotBalances: IHyperliquidSpotBalanceSnapshot[] | undefined,
): boolean {
  return Boolean(
    spotBalances?.some(
      (b) =>
        b.token !== 0 &&
        !isHyperliquidSpotStableCoin(b.coin) &&
        safeBN(b.total).gt(0),
    ),
  );
}

export function spotNeedsPrices(
  spot: ISpotClearinghouseStateResponse | undefined,
): boolean {
  return Boolean(
    spot?.balances?.some(
      (b) =>
        b.token !== 0 &&
        !isHyperliquidSpotStableCoin(b.coin) &&
        safeBN(b.total).gt(0),
    ),
  );
}

export function spotHasPositiveBalance(
  spot: ISpotClearinghouseStateResponse | undefined,
): boolean {
  return Boolean(spot?.balances?.some((b) => safeBN(b.total).gt(0)));
}

export function getHyperliquidPortfolioSnapshotMaxAge(
  snapshot: Pick<
    IHyperliquidPortfolioSnapshot,
    'isDegraded' | 'perpPositions' | 'spotBalances'
  >,
): number {
  if (
    snapshot.isDegraded ||
    snapshot.perpPositions.length > 0 ||
    spotBalancesNeedPriceRefresh(snapshot.spotBalances)
  ) {
    // Degraded snapshots should recover quickly; marked-to-market snapshots move with price.
    return PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS;
  }
  return PERPS_HL_PORTFOLIO_SNAPSHOT_MAX_AGE_MS;
}

export function isHyperliquidPortfolioSnapshotFresh(
  snapshot: Pick<
    IHyperliquidPortfolioSnapshot,
    'fetchedAt' | 'isDegraded' | 'perpPositions' | 'spotBalances'
  >,
  now = Date.now(),
): boolean {
  return (
    now - snapshot.fetchedAt <= getHyperliquidPortfolioSnapshotMaxAge(snapshot)
  );
}

export function isUnifiedPortfolioMode(
  mode: EHyperLiquidAbstractionMode | string | undefined,
) {
  return (
    mode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
    mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN
  );
}

export function getActivePerpAssetPositions(
  positions: IPerpAssetPosition[] | undefined | null,
): IPerpAssetPosition[] {
  return (positions ?? []).filter((position) =>
    safeBN(position.position?.szi).abs().gt(0),
  );
}

export function getActivePerpPositionsUnrealizedPnl(
  positions: IPerpAssetPosition[] | undefined | null,
): string {
  return getActivePerpAssetPositions(positions)
    .reduce(
      (sum, position) => sum.plus(safeBN(position.position?.unrealizedPnl)),
      new BigNumber(0),
    )
    .toFixed();
}

function mergeNonUnifiedPerpsUsdcBalance({
  balances,
  perpsTotalRawUsd,
  perpsWithdrawable,
}: {
  balances: ISpotBalance[];
  perpsTotalRawUsd: string;
  perpsWithdrawable: string;
}): ISpotBalance[] {
  const perpsUsdcTotalBN = safeBN(perpsTotalRawUsd);
  if (perpsUsdcTotalBN.lte(0)) {
    return balances;
  }

  const perpsUsdcHoldBN = BigNumber.max(
    perpsUsdcTotalBN.minus(safeBN(perpsWithdrawable)),
    0,
  );
  let merged = false;
  const nextBalances = balances.map((balance) => {
    if (balance.token !== 0) {
      return balance;
    }
    merged = true;
    const total = safeBN(balance.total).plus(perpsUsdcTotalBN).toFixed();
    return {
      ...balance,
      coin: USDC,
      total,
      hold: safeBN(balance.hold).plus(perpsUsdcHoldBN).toFixed(),
      entryNtl: total,
    };
  });

  if (merged) {
    return nextBalances;
  }
  return [
    ...nextBalances,
    {
      coin: USDC,
      token: 0,
      total: perpsUsdcTotalBN.toFixed(),
      hold: perpsUsdcHoldBN.toFixed(),
      entryNtl: perpsUsdcTotalBN.toFixed(),
    },
  ];
}

export function assembleHyperliquidSnapshot(args: {
  address: string;
  clearinghouse: IClearinghouseStateResponse | undefined;
  spot: ISpotClearinghouseStateResponse | undefined;
  priceMap: Record<string, string>;
  getSpotMarkPrice?: (coin: string) => string | undefined;
  getSpotUniverseName?: (coin: string) => string | undefined;
  abstractionMode?: EHyperLiquidAbstractionMode | string | undefined;
  isDegraded?: boolean;
  now: number;
}): IHyperliquidPortfolioSnapshot {
  const {
    clearinghouse,
    spot,
    priceMap,
    getSpotMarkPrice,
    getSpotUniverseName,
    now,
  } = args;
  const address = (args.address || '').toLowerCase();
  const clearinghouseAccountValue =
    clearinghouse?.marginSummary?.accountValue ?? '0';
  const clearinghouseTotalRawUsd =
    clearinghouse?.marginSummary?.totalRawUsd ?? '0';
  const totalMarginUsed = clearinghouse?.marginSummary?.totalMarginUsed ?? '0';

  const activeAssetPositions = getActivePerpAssetPositions(
    clearinghouse?.assetPositions,
  );
  const perpPositions: IHyperliquidPerpPositionSnapshot[] =
    activeAssetPositions.map((p) => ({
      coin: p.position.coin,
      szi: p.position.szi,
      entryPx: p.position.entryPx,
      positionValue: p.position.positionValue,
      unrealizedPnl: p.position.unrealizedPnl,
      returnOnEquity: p.position.returnOnEquity,
      liquidationPx: p.position.liquidationPx,
      marginUsed: p.position.marginUsed,
      leverageType: p.position.leverage.type,
      leverageValue: p.position.leverage.value,
      cumFundingSinceOpen: p.position.cumFunding.sinceOpen,
    }));
  const totalUnrealizedPnl = getActivePerpPositionsUnrealizedPnl(
    clearinghouse?.assetPositions,
  );

  let degraded = Boolean(args.isDegraded);
  const getMarkPrice = (coin: string) =>
    getSpotMarkPrice?.(coin) ?? priceMap[coin];
  const isUnified = isUnifiedPortfolioMode(args.abstractionMode);
  const rawSpotBalances = spot?.balances ?? [];
  // Keep raw spot balances for totals; the merged USDC row is display-only
  // because non-unified clearinghouse accountValue already includes perps USDC.
  const displaySpotBalances = isUnified
    ? rawSpotBalances
    : mergeNonUnifiedPerpsUsdcBalance({
        balances: rawSpotBalances,
        perpsTotalRawUsd: clearinghouseTotalRawUsd,
        perpsWithdrawable: clearinghouse?.withdrawable ?? '0',
      });
  const spotTotal = calculateSpotBalancesTotalUsd({
    balances: rawSpotBalances,
    getMarkPrice,
  });
  if (spotTotal.missingPriceCoins.length > 0) {
    degraded = true;
  }
  const spotBalances: IHyperliquidSpotBalanceSnapshot[] =
    displaySpotBalances.map((b) => {
      const rawPrice =
        b.token === 0 || isHyperliquidSpotStableCoin(b.coin)
          ? '1'
          : getMarkPrice(b.coin);
      const priceBN =
        rawPrice !== undefined ? new BigNumber(rawPrice) : undefined;
      const priceUsable =
        priceBN !== undefined && priceBN.isFinite() && priceBN.gt(0);
      const totalBN = safeBN(b.total);
      const valueUsd = priceUsable
        ? totalBN.times(priceBN).toFixed()
        : undefined;
      if (!priceUsable && totalBN.gt(0)) degraded = true;
      return {
        coin: b.coin,
        spotUniverseName: getSpotUniverseName?.(b.coin),
        token: b.token,
        total: b.total,
        hold: b.hold,
        entryNtl: b.entryNtl,
        priceUsd: priceUsable ? rawPrice : undefined,
        valueUsd,
      };
    });

  const spotTotalUsd = spotTotal.totalUsd;
  const usdcBalance = rawSpotBalances.find((b) => b.token === 0);
  const accountValue = isUnified ? spotTotalUsd : clearinghouseAccountValue;
  const withdrawable = isUnified
    ? safeBN(usdcBalance?.total).minus(safeBN(usdcBalance?.hold)).toFixed()
    : (clearinghouse?.withdrawable ?? '0');
  const netWorthUsd = isUnified
    ? spotTotalUsd
    : safeBN(clearinghouseAccountValue).plus(spotTotalUsd).toFixed();
  const hasPerp =
    safeBN(clearinghouseAccountValue).gt(0) || perpPositions.length > 0;
  const hasSpot = spotBalances.some((b) => safeBN(b.total).gt(0));

  return {
    address,
    isEmpty: !degraded && !hasPerp && !hasSpot,
    accountValue,
    withdrawable,
    totalMarginUsed,
    totalUnrealizedPnl,
    perpPositions,
    spotBalances,
    spotTotalUsd,
    netWorthUsd,
    abstractionMode: args.abstractionMode,
    source: 'rest',
    isDegraded: degraded,
    summaryUpdatedAt: now,
    spotUpdatedAt: now,
    priceCachedAt: now,
    fetchedAt: now,
  };
}
