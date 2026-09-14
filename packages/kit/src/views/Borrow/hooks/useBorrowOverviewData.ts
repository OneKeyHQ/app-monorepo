import { useCallback, useEffect, useState } from 'react';

import { getBorrowEarnAccountId } from '../borrowEarnAccount';
import { useBorrowContext } from '../BorrowProvider';

import { useBorrowHealthFactor } from './useBorrowHealthFactor';
import { useBorrowRewards } from './useBorrowRewards';

/**
 * The overview data the Borrow home needs in more than one place: the health
 * factor drives both the metric shown to the user and the at-risk alerts, and
 * on phones the metrics themselves are split between the top of the page and
 * the summary below the positions. Owning the requests here keeps one copy of
 * each, whichever blocks happen to be on screen.
 */
export const useBorrowOverviewData = ({
  isActive = true,
  refreshEModeStatus,
}: {
  isActive?: boolean;
  refreshEModeStatus?: () => Promise<unknown>;
} = {}) => {
  const { reserves, market, earnAccount, setRefreshAllBorrowData } =
    useBorrowContext();
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const provider = market?.provider;
  const networkId = market?.networkId;
  const marketAddress = market?.marketAddress;
  const earnAccountId = getBorrowEarnAccountId(earnAccount.data);

  const hasMarketAndAccount = !!(
    networkId &&
    provider &&
    marketAddress &&
    earnAccountId
  );

  const {
    healthFactorData,
    isInitialLoading: isHealthFactorInitialLoading,
    isLoading: isHealthFactorRequestLoading,
    isError: isHealthFactorError,
    refresh: refreshHealthFactor,
  } = useBorrowHealthFactor({
    networkId,
    provider,
    marketAddress,
    accountId: earnAccountId,
    enabled: isActive && hasMarketAndAccount,
  });

  const {
    borrowRewards,
    isInitialLoading: isRewardsInitialLoading,
    isLoading: isRewardsRequestLoading,
    isError: isRewardsError,
    refresh: refreshBorrowRewards,
  } = useBorrowRewards({
    networkId,
    provider,
    marketAddress,
    accountId: earnAccountId,
    enabled: isActive && hasMarketAndAccount,
  });

  const isAccountPending = Boolean(
    isActive &&
    networkId &&
    provider &&
    marketAddress &&
    earnAccount.loading &&
    !earnAccountId,
  );
  const isHealthFactorLoading =
    isAccountPending ||
    isHealthFactorInitialLoading ||
    (Boolean(isHealthFactorRequestLoading) &&
      !healthFactorData &&
      !isHealthFactorError);
  const isRewardsLoading =
    isAccountPending ||
    isRewardsInitialLoading ||
    (Boolean(isRewardsRequestLoading) && !borrowRewards && !isRewardsError);

  const refreshReserves = reserves.refresh;
  const requestRefresh = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([
        refreshReserves(),
        refreshBorrowRewards(),
        refreshHealthFactor(),
        refreshEModeStatus?.(),
      ]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [
    refreshBorrowRewards,
    refreshEModeStatus,
    refreshHealthFactor,
    refreshReserves,
  ]);

  useEffect(() => {
    setRefreshAllBorrowData(requestRefresh);
    return () => {
      setRefreshAllBorrowData(() => Promise.resolve());
    };
  }, [requestRefresh, setRefreshAllBorrowData]);

  return {
    healthFactorData,
    isHealthFactorLoading,
    borrowRewards,
    isRewardsLoading,
    isManualRefreshing,
    requestRefresh,
  };
};

export type IBorrowOverviewData = ReturnType<typeof useBorrowOverviewData>;
