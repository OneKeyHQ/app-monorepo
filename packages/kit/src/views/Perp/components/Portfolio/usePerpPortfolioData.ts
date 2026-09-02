import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountSummaryAtom,
  usePerpsTradesHistoryDataAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { HYPEREVM_SYSTEM_ADDRESS } from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IUserNonFundingLedgerUpdatesResponse } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  buildPerpPortfolioFillsStats,
  buildPortfolioChartData,
  getStartTimeForPeriod,
} from './portfolioStats';

import type { IPortfolioPnlType, IPortfolioTimePeriod } from './portfolioStats';

export type {
  IPortfolioChartType,
  IPortfolioPnlType,
  IPortfolioTimePeriod,
} from './portfolioStats';

export function usePerpPortfolioData(
  timePeriod: IPortfolioTimePeriod,
  activityType: IPortfolioPnlType = 'all',
) {
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

  usePromiseResult(
    async () => {
      if (!address) {
        await backgroundApiProxy.serviceHyperliquid.resetTradesHistory();
        return null;
      }
      await backgroundApiProxy.serviceHyperliquid.loadTradesHistory(address);
      return null;
    },
    [address],
    { watchLoading: false, checkIsFocused: false },
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
    return buildPortfolioChartData({ portfolioData, timePeriod });
  }, [portfolioData, timePeriod]);

  const fillsStatsByType = useMemo(() => {
    const isMatchingAddress = tradesHistoryData?.accountAddress === address;
    const fills = isMatchingAddress ? (tradesHistoryData?.fills ?? []) : [];
    return {
      all: buildPerpPortfolioFillsStats({
        fills,
        timePeriod,
        pnlType: 'all',
      }),
      perps: buildPerpPortfolioFillsStats({
        fills,
        timePeriod,
        pnlType: 'perps',
      }),
      spot: buildPerpPortfolioFillsStats({
        fills,
        timePeriod,
        pnlType: 'spot',
      }),
    };
  }, [tradesHistoryData, timePeriod, address]);
  const fillsStats = fillsStatsByType[activityType];

  const pnlTotals = useMemo(() => {
    const getLastValue = (history: [number, number][] | undefined) => {
      if (!history?.length) return null;
      return history[history.length - 1]?.[1] ?? null;
    };
    return {
      all: getLastValue(chartData?.pnlHistory),
      perps: getLastValue(chartData?.perpsPnlHistory),
      spot: getLastValue(chartData?.nonPerpsPnlHistory),
    };
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
        // CCTP withdrawals leave HyperCore as a `send` to the HyperEVM system
        // address, not as a `withdraw`, so without this they stop counting the
        // moment we switch rails and this stat drifts up on every withdrawal.
        // Only the outbound leg is matched: the inbound EVM -> Core credit
        // arrives as a `spotTransfer` from the system address, and counting it
        // would double up against the `accountClassTransfer` branch below. That
        // asymmetry, and this reducer's mixed perp-scope / whole-account scope,
        // predate this change and are tracked separately.
        if (
          delta.type === 'send' &&
          delta.token === 'USDC' &&
          delta.destination?.toLowerCase() ===
            HYPEREVM_SYSTEM_ADDRESS.toLowerCase() &&
          delta.amount
        ) {
          return sum.minus(delta.amount);
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
    pnlTotals,
    isLoading: isChartLoading,
  };
}
