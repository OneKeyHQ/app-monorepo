import BigNumber from 'bignumber.js';

import type { IHyperliquidPortfolioSnapshot } from '../../types/hyperliquid/portfolio';

export interface IPerpsHomeHolding {
  symbol: string;
  balance: string; // token amount
  valueUsd: number | undefined; // undefined => price unavailable
  pnlUsd: number | undefined; // value - entryNtl; undefined if no price
}
export interface IPerpsHomePosition {
  coin: string;
  side: 'long' | 'short';
  leverageType: 'isolated' | 'cross';
  leverageValue: number;
  pnlUsd: number;
  roi: number; // returnOnEquity fraction (0.1 = +10%)
  sizeCoin: string; // |szi|
  marginUsd: number;
  entryPx: string;
  fundingUsd: number; // cumFunding.sinceOpen (positive = paid)
  markPx: string; // derived positionValue / |szi|
  liqPx: string | null;
}
export interface IPerpsHomeView {
  isEmpty: boolean;
  accountValueUsd: number;
  netWorthUsd: number;
  holdings: IPerpsHomeHolding[];
  positions: IPerpsHomePosition[];
  isDegraded: boolean;
}

export function mapSnapshotToPerpsHomeView(
  snapshot: IHyperliquidPortfolioSnapshot,
): IPerpsHomeView {
  const positions: IPerpsHomePosition[] = snapshot.perpPositions.map((p) => {
    const sziBN = new BigNumber(p.szi);
    const absSz = sziBN.abs();
    const markPx = absSz.gt(0)
      ? new BigNumber(p.positionValue).div(absSz).toFixed()
      : p.entryPx;
    return {
      coin: p.coin,
      side: sziBN.isNegative() ? 'short' : 'long',
      leverageType: p.leverageType,
      leverageValue: p.leverageValue,
      pnlUsd: Number(p.unrealizedPnl) || 0,
      roi: Number(p.returnOnEquity) || 0,
      sizeCoin: absSz.toFixed(),
      marginUsd: Number(p.marginUsed) || 0,
      entryPx: p.entryPx,
      fundingUsd: Number(p.cumFundingSinceOpen) || 0,
      markPx,
      liqPx: p.liquidationPx,
    };
  });

  const holdings: IPerpsHomeHolding[] = snapshot.spotBalances
    .filter((b) => Number(b.total) > 0)
    .map((b) => {
      const priced = b.valueUsd !== undefined && b.priceUsd !== undefined;
      const valueUsd = priced ? Number(b.valueUsd) : undefined;
      const pnlUsd =
        priced && b.entryNtl !== undefined
          ? Number(
              new BigNumber(b.valueUsd as string).minus(b.entryNtl).toFixed(),
            )
          : undefined;
      return { symbol: b.coin, balance: b.total, valueUsd, pnlUsd };
    });

  return {
    isEmpty: snapshot.isEmpty,
    accountValueUsd: Number(snapshot.accountValue) || 0,
    netWorthUsd: Number(snapshot.netWorthUsd) || 0,
    holdings,
    positions,
    isDegraded: snapshot.isDegraded,
  };
}
