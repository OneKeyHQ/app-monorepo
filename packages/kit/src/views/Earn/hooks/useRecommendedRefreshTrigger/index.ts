import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { useRecommendedRefreshAppEvents } from './useRecommendedRefreshAppEvents';
import { useRecommendedRefreshPendingTx } from './useRecommendedRefreshPendingTx';
import { useRecommendedRefreshScheduler } from './useRecommendedRefreshScheduler';
import { useRecommendedRefreshScope } from './useRecommendedRefreshScope';
import { useRecommendedRefreshSwapEvents } from './useRecommendedRefreshSwapEvents';

export function useRecommendedRefreshTrigger({
  accountId,
  indexedAccountId,
  networkId,
  recommendedTokens,
  enableFetch,
  onRefresh,
}: {
  accountId?: string;
  indexedAccountId?: string;
  networkId: string;
  recommendedTokens: IRecommendAsset[];
  enableFetch: boolean;
  onRefresh: () => Promise<void>;
}) {
  const { scheduleRecommendedRefresh } = useRecommendedRefreshScheduler({
    onRefresh,
  });

  const {
    historyRefreshAccounts,
    recommendedNetworkIds,
    tagMatcher,
    shouldRefreshByAccounts,
  } = useRecommendedRefreshScope({
    accountId,
    indexedAccountId,
    networkId,
    recommendedTokens,
    enableFetch,
  });

  useRecommendedRefreshAppEvents({
    accountId,
    networkId,
    enableFetch,
    shouldRefreshByAccounts,
    scheduleRecommendedRefresh,
  });

  useRecommendedRefreshSwapEvents({
    accountId,
    networkId,
    enableFetch,
    historyRefreshAccounts,
    shouldRefreshByAccounts,
    scheduleRecommendedRefresh,
  });

  useRecommendedRefreshPendingTx({
    enableFetch,
    recommendedNetworkIds,
    tagMatcher,
    scheduleRecommendedRefresh,
  });
}
