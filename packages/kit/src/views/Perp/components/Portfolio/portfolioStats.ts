import BigNumber from 'bignumber.js';

import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IFill,
  IPortfolio,
  IPortfolioMetrics,
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

  const feesPaid = filteredFills
    .reduce((sum, f) => sum.plus(f.fee), new BigNumber(0))
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
