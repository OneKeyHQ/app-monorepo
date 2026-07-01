import BigNumber from 'bignumber.js';

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

function safeBN(v: string | number | undefined | null): BigNumber {
  const bn = new BigNumber(v ?? 0);
  return bn.isFinite() ? bn : new BigNumber(0);
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
    // Prefer the USDC-quoted market so token/token pairs never override a USD price.
    const isUsdcQuoted = (quoteToken?.name ?? USDC) === USDC;
    if (isUsdcQuoted || priceMap[baseName] === undefined) {
      priceMap[baseName] = px;
    }
  });
  return priceMap;
}

export function spotNeedsPrices(
  spot: ISpotClearinghouseStateResponse | undefined,
): boolean {
  return Boolean(
    spot?.balances?.some((b) => b.coin !== USDC && safeBN(b.total).gt(0)),
  );
}

export function assembleHyperliquidSnapshot(args: {
  address: string;
  clearinghouse: IClearinghouseStateResponse | undefined;
  spot: ISpotClearinghouseStateResponse | undefined;
  priceMap: Record<string, string>;
  now: number;
}): IHyperliquidPortfolioSnapshot {
  const { clearinghouse, spot, priceMap, now } = args;
  const address = (args.address || '').toLowerCase();
  const accountValue = clearinghouse?.marginSummary?.accountValue ?? '0';
  const withdrawable = clearinghouse?.withdrawable ?? '0';
  const totalMarginUsed = clearinghouse?.marginSummary?.totalMarginUsed ?? '0';

  const perpPositions: IHyperliquidPerpPositionSnapshot[] = (
    clearinghouse?.assetPositions ?? []
  ).map((p) => ({
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
  const totalUnrealizedPnl = perpPositions
    .reduce((s, p) => s.plus(safeBN(p.unrealizedPnl)), new BigNumber(0))
    .toFixed();

  let degraded = false;
  let spotTotal = new BigNumber(0);
  const spotBalances: IHyperliquidSpotBalanceSnapshot[] = (
    spot?.balances ?? []
  ).map((b) => {
    const rawPrice = b.coin === USDC ? '1' : priceMap[b.coin];
    const priceBN =
      rawPrice !== undefined ? new BigNumber(rawPrice) : undefined;
    const priceUsable =
      priceBN !== undefined && priceBN.isFinite() && priceBN.gt(0);
    const totalBN = safeBN(b.total);
    const valueUsd = priceUsable ? totalBN.times(priceBN).toFixed() : undefined;
    if (!priceUsable && totalBN.gt(0)) degraded = true;
    else if (valueUsd !== undefined) spotTotal = spotTotal.plus(valueUsd);
    return {
      coin: b.coin,
      token: b.token,
      total: b.total,
      hold: b.hold,
      entryNtl: b.entryNtl,
      priceUsd: priceUsable ? rawPrice : undefined,
      valueUsd,
    };
  });

  const spotTotalUsd = spotTotal.toFixed();
  const netWorthUsd = safeBN(accountValue).plus(spotTotalUsd).toFixed();
  const hasPerp = safeBN(accountValue).gt(0) || perpPositions.length > 0;
  const hasSpot = spotBalances.some((b) => safeBN(b.total).gt(0));

  return {
    address,
    isEmpty: !hasPerp && !hasSpot,
    accountValue,
    withdrawable,
    totalMarginUsed,
    totalUnrealizedPnl,
    perpPositions,
    spotBalances,
    spotTotalUsd,
    netWorthUsd,
    source: 'rest',
    isDegraded: degraded,
    summaryUpdatedAt: now,
    spotUpdatedAt: now,
    priceCachedAt: now,
    fetchedAt: now,
  };
}
