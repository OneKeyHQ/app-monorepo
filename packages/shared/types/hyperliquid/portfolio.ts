export interface IHyperliquidPerpPositionSnapshot {
  coin: string;
  szi: string; // signed; negative = short
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  marginUsed: string;
  leverageType: 'cross' | 'isolated';
  leverageValue: number;
  cumFundingSinceOpen: string;
}

export interface IHyperliquidSpotBalanceSnapshot {
  coin: string;
  spotUniverseName?: string;
  token: number;
  total: string;
  hold: string;
  entryNtl: string; // cost basis notional; used for spot per-coin PnL
  priceUsd: string | undefined; // undefined => price unavailable (degraded)
  valueUsd: string | undefined;
}

export interface IHyperliquidPortfolioSnapshot {
  address: string; // normalized lowercase EVM address
  isEmpty: boolean; // both perp and spot empty
  accountValue: string;
  withdrawable: string;
  totalMarginUsed: string;
  totalUnrealizedPnl: string;
  perpPositions: IHyperliquidPerpPositionSnapshot[];
  spotBalances: IHyperliquidSpotBalanceSnapshot[];
  spotTotalUsd: string;
  netWorthUsd: string; // unified/PM: spotTotalUsd; otherwise accountValue + spotTotalUsd
  abstractionMode?: string;
  source: 'rest' | 'ws';
  isDegraded: boolean; // estimated snapshot: spot price missing or optional dex unavailable
  summaryUpdatedAt: number;
  spotUpdatedAt: number;
  priceCachedAt: number;
  fetchedAt: number; // recency for cache eviction + monotonic guard
}
