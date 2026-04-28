import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsTradesHistoryDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IPortfolioMetrics,
  IUserNonFundingLedgerUpdatesResponse,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

export type IPortfolioTimePeriod = 'day' | 'week' | 'month' | 'allTime';

export type IPortfolioChartType = 'accountValue' | 'pnl';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;

function getStartTimeForPeriod(period: IPortfolioTimePeriod): number {
  const now = Date.now();
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

const PERIOD_KEY_MAP: Record<IPortfolioTimePeriod, string> = {
  day: 'perpDay',
  week: 'perpWeek',
  month: 'perpMonth',
  allTime: 'perpAllTime',
};

export function usePerpPortfolioData(timePeriod: IPortfolioTimePeriod) {
  const [selectedAccount] = usePerpsActiveAccountAtom();
  const [accountSummary] = usePerpsActiveAccountSummaryAtom();
  const [tradesHistoryData] = usePerpsTradesHistoryDataAtom();

  const address = selectedAccount.accountAddress;

  const { result: portfolioData, isLoading: isChartLoading } = usePromiseResult(
    async () => {
      if (!address) return null;
      return backgroundApiProxy.serviceHyperliquid.getPortfolioHistory({
        address,
      });
    },
    [address],
    { watchLoading: true, checkIsFocused: false },
  );

  const startTime = useMemo(
    () => getStartTimeForPeriod(timePeriod),
    [timePeriod],
  );

  const { result: netDepositsData } = usePromiseResult(
    async () => {
      if (!address) return null;
      return backgroundApiProxy.serviceHyperliquid.getPortfolioNetDeposits({
        address,
        startTime,
      });
    },
    [address, startTime],
    { watchLoading: true, checkIsFocused: false },
  );

  const chartData = useMemo(() => {
    if (!portfolioData) return null;
    const entry = portfolioData.find(
      ([key]) => key === PERIOD_KEY_MAP[timePeriod],
    );
    if (!entry) return null;
    const metrics: IPortfolioMetrics = entry[1];
    return {
      // portfolio API returns milliseconds; LightweightChart needs UTC seconds
      accountValueHistory: metrics.accountValueHistory.map(
        ([ts, val]): [number, number] => [
          Math.floor(ts / 1000),
          parseFloat(val),
        ],
      ),
      pnlHistory: metrics.pnlHistory.map(([ts, val]): [number, number] => [
        Math.floor(ts / 1000),
        parseFloat(val),
      ]),
      vlm: metrics.vlm,
    };
  }, [portfolioData, timePeriod]);

  const fillsStats = useMemo(() => {
    const isMatchingAddress = tradesHistoryData?.accountAddress === address;
    const fills = isMatchingAddress
      ? (tradesHistoryData?.fills ?? []).filter(
          (f) => !isSpotInstrument(f.coin),
        )
      : [];
    const startMs = getStartTimeForPeriod(timePeriod);

    const filteredFills = fills.filter((fill) => {
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

    return {
      winRate,
      avgWin,
      avgLoss,
      feesPaid,
      mostTraded,
      profitFactor,
      realizedPnl,
      totalTrades: filteredFills.length,
    };
  }, [tradesHistoryData, timePeriod, address]);

  // Use the portfolio API's pnlHistory for Total P&L (includes fees & funding)
  const totalPnl = useMemo(() => {
    if (!chartData?.pnlHistory?.length) return null;
    const lastEntry = chartData.pnlHistory[chartData.pnlHistory.length - 1];
    return lastEntry?.[1] ?? null;
  }, [chartData]);

  const netDeposits = useMemo(() => {
    if (!netDepositsData) return null;
    return netDepositsData
      .reduce((sum, update: IUserNonFundingLedgerUpdatesResponse[number]) => {
        const { delta } = update;
        if (delta.type === 'deposit' && delta.usdc) {
          return sum.plus(delta.usdc);
        }
        if (delta.type === 'withdraw' && delta.usdc) {
          return sum.minus(delta.usdc);
        }
        if (
          delta.type === 'accountClassTransfer' &&
          delta.usdc &&
          delta.toPerp !== undefined
        ) {
          return delta.toPerp ? sum.plus(delta.usdc) : sum.minus(delta.usdc);
        }
        return sum;
      }, new BigNumber(0))
      .toNumber();
  }, [netDepositsData]);

  return {
    chartData,
    fillsStats,
    netDeposits,
    accountSummary,
    totalPnl,
    isLoading: isChartLoading,
  };
}
