import { useStakingPendingTxsByInfo } from '../useStakingPendingTxs';

import type { IScheduleRecommendedRefresh } from './types';

const DISABLED_RECOMMENDED_NETWORK_IDS: string[] = [];

export function useRecommendedRefreshPendingTx({
  enableFetch,
  recommendedNetworkIds,
  tagMatcher,
  scheduleRecommendedRefresh,
}: {
  enableFetch: boolean;
  recommendedNetworkIds: string[];
  tagMatcher: (tag: string) => boolean;
  scheduleRecommendedRefresh: IScheduleRecommendedRefresh;
}) {
  useStakingPendingTxsByInfo({
    networkIds: enableFetch
      ? recommendedNetworkIds
      : DISABLED_RECOMMENDED_NETWORK_IDS,
    tagMatcher,
    onRefresh: enableFetch
      ? () => {
          scheduleRecommendedRefresh({ source: 'pending-tx' });
        }
      : undefined,
    onRefreshDelayMs: 0,
  });
}
