import BigNumber from 'bignumber.js';

import {
  isSpotInstrument,
  isUsdcDenominatedFee,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import { HYPEREVM_SYSTEM_ADDRESS } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  IFill,
  IPortfolio,
  IPortfolioMetrics,
  IUserNonFundingLedgerUpdatesResponse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

export type IPortfolioTimePeriod = 'day' | 'week' | 'month' | 'allTime';
export type IPortfolioChartType = 'accountValue' | 'pnl';
export type IPortfolioPnlType = 'all' | 'perps' | 'spot';

export type IPortfolioChartData = {
  accountValueHistory: [number, number][];
  pnlHistory: [number, number][];
  perpsPnlHistory: [number, number][];
  nonPerpsPnlHistory: [number, number][];
  vlm: string;
};

export type IPerpPortfolioFillsStats = {
  winRate: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  feesPaid: number;
  volumeUsd: number;
  mostTraded: string | null;
  profitFactor: number | null;
  realizedPnl: number;
  spotRealizedPnl: number;
  totalTrades: number;
};

type IPortfolioData = IPortfolio[number][];

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

const COMBINED_PERIOD_KEY_MAP: Record<IPortfolioTimePeriod, string> = {
  day: 'day',
  week: 'week',
  month: 'month',
  allTime: 'allTime',
};

const PERP_PERIOD_KEY_MAP: Record<IPortfolioTimePeriod, string> = {
  day: 'perpDay',
  week: 'perpWeek',
  month: 'perpMonth',
  allTime: 'perpAllTime',
};

export function getStartTimeForPeriod(
  period: IPortfolioTimePeriod,
  now = Date.now(),
): number {
  switch (period) {
    case 'day':
      return now - ONE_DAY_MS;
    case 'week':
      return now - ONE_WEEK_MS;
    case 'month':
      return now - ONE_MONTH_MS;
    case 'allTime':
    default:
      return 0;
  }
}

function formatHistory(
  history: IPortfolioMetrics['pnlHistory'],
): [number, number][] {
  return history.map(([ts, val]): [number, number] => [
    Math.floor(ts / 1000),
    parseFloat(val),
  ]);
}

function getPortfolioMetrics(
  portfolioData: IPortfolioData,
  key: string,
): IPortfolioMetrics | null {
  const entry = portfolioData.find(([entryKey]) => entryKey === key);
  return entry?.[1] ?? null;
}

function subtractHistory(
  history: [number, number][],
  subtrahend: [number, number][],
): [number, number][] {
  const subtrahendMap = new Map(subtrahend);
  return history.map(([ts, val]) => [ts, val - (subtrahendMap.get(ts) ?? 0)]);
}

export function buildPortfolioChartData({
  portfolioData,
  timePeriod,
}: {
  portfolioData: IPortfolioData;
  timePeriod: IPortfolioTimePeriod;
}): IPortfolioChartData | null {
  const combinedMetrics = getPortfolioMetrics(
    portfolioData,
    COMBINED_PERIOD_KEY_MAP[timePeriod],
  );
  if (!combinedMetrics) return null;

  const perpsMetrics = getPortfolioMetrics(
    portfolioData,
    PERP_PERIOD_KEY_MAP[timePeriod],
  );

  const pnlHistory = formatHistory(combinedMetrics.pnlHistory);
  const perpsPnlHistory = perpsMetrics
    ? formatHistory(perpsMetrics.pnlHistory)
    : [];

  return {
    accountValueHistory: formatHistory(combinedMetrics.accountValueHistory),
    pnlHistory,
    perpsPnlHistory,
    nonPerpsPnlHistory: subtractHistory(pnlHistory, perpsPnlHistory),
    vlm: combinedMetrics.vlm,
  };
}

export function buildPerpPortfolioFillsStats({
  fills,
  timePeriod,
  pnlType = 'all',
  now,
}: {
  fills: IFill[];
  timePeriod: IPortfolioTimePeriod;
  pnlType?: IPortfolioPnlType;
  now?: number;
}): IPerpPortfolioFillsStats {
  const startMs = getStartTimeForPeriod(timePeriod, now);

  const filteredFills = fills.filter((fill) => {
    const isSpotFill = isSpotInstrument(fill.coin);
    if (pnlType === 'perps' && isSpotFill) return false;
    if (pnlType === 'spot' && !isSpotFill) return false;
    if (timePeriod !== 'allTime' && fill.time < startMs) return false;
    return new BigNumber(fill.closedPnl).isFinite();
  });

  const closedFills = filteredFills.filter((fill) =>
    new BigNumber(fill.closedPnl).abs().gt(0),
  );

  const winFills = closedFills.filter((fill) =>
    new BigNumber(fill.closedPnl).gt(0),
  );
  const lossFills = closedFills.filter((fill) =>
    new BigNumber(fill.closedPnl).lt(0),
  );

  const winRate =
    closedFills.length > 0
      ? (winFills.length / closedFills.length) * 100
      : null;

  const avgWin =
    winFills.length > 0
      ? winFills
          .reduce((sum, f) => sum.plus(f.closedPnl), new BigNumber(0))
          .div(winFills.length)
          .toNumber()
      : null;

  const avgLoss =
    lossFills.length > 0
      ? lossFills
          .reduce((sum, f) => sum.plus(f.closedPnl), new BigNumber(0))
          .div(lossFills.length)
          .toNumber()
      : null;

  // Base-token fees (spot buys) are token units, not USD; convert them at the
  // fill's own price (the same px volumeUsd trusts). A fill without a usable
  // price is dropped rather than counted as raw token units.
  const feesPaid = filteredFills
    .reduce((sum, f) => {
      if (isUsdcDenominatedFee(f.feeToken)) {
        return sum.plus(f.fee);
      }
      const px = new BigNumber(f.px);
      const fee = new BigNumber(f.fee);
      return px.isFinite() && px.gt(0) && fee.isFinite()
        ? sum.plus(fee.multipliedBy(px))
        : sum;
    }, new BigNumber(0))
    .toNumber();

  const volumeUsd = filteredFills
    .reduce((sum, f) => {
      const size = new BigNumber(f.sz);
      const price = new BigNumber(f.px);
      if (!size.isFinite() || !price.isFinite()) {
        return sum;
      }
      return sum.plus(size.abs().multipliedBy(price));
    }, new BigNumber(0))
    .toNumber();

  const coinCounts: Record<string, number> = {};
  filteredFills.forEach((fill) => {
    coinCounts[fill.coin] = (coinCounts[fill.coin] ?? 0) + 1;
  });
  let mostTraded: string | null = null;
  let maxCount = 0;
  Object.entries(coinCounts).forEach(([coin, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostTraded = coin;
    }
  });

  const totalGain = winFills.reduce(
    (sum, f) => sum.plus(f.closedPnl),
    new BigNumber(0),
  );
  const totalLoss = lossFills
    .reduce((sum, f) => sum.plus(f.closedPnl), new BigNumber(0))
    .abs();
  const profitFactor = totalLoss.gt(0)
    ? totalGain.div(totalLoss).toNumber()
    : null;

  const realizedPnl = totalGain.minus(totalLoss).toNumber();
  const spotRealizedPnl = closedFills
    .filter((fill) => isSpotInstrument(fill.coin))
    .reduce((sum, fill) => sum.plus(fill.closedPnl), new BigNumber(0))
    .toNumber();

  return {
    winRate,
    avgWin,
    avgLoss,
    feesPaid,
    volumeUsd,
    mostTraded,
    profitFactor,
    realizedPnl,
    spotRealizedPnl,
    totalTrades: filteredFills.length,
  };
}

// Per its own tooltip this is deposits minus withdrawals, so internal perp/spot
// moves must not count. USDC leaves HyperCore as a `send` to the system address
// and returns as a `spotTransfer` from it; both legs or a round trip drifts.
export function sumPerpsNetDeposits(
  updates: IUserNonFundingLedgerUpdatesResponse | undefined | null,
): number | null {
  if (!updates) {
    return null;
  }
  const systemAddress = HYPEREVM_SYSTEM_ADDRESS.toLowerCase();
  return updates
    .reduce((sum, update) => {
      const { delta } = update;
      if (delta.type === 'deposit' && delta.usdc) {
        return sum.plus(delta.usdc);
      }
      if (delta.type === 'withdraw' && delta.usdc) {
        return sum.minus(delta.usdc);
      }
      if (delta.type === 'send' && delta.token === 'USDC' && delta.amount) {
        if (delta.destination?.toLowerCase() === systemAddress) {
          return sum.minus(delta.amount);
        }
        return sum;
      }
      if (
        delta.type === 'spotTransfer' &&
        delta.token === 'USDC' &&
        delta.user?.toLowerCase() === systemAddress &&
        delta.amount
      ) {
        return sum.plus(delta.amount);
      }
      return sum;
    }, new BigNumber(0))
    .toNumber();
}
