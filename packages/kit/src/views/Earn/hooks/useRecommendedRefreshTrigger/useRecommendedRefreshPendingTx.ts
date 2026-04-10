import { useStakingPendingTxsByInfo } from '../useStakingPendingTxs';

import type { IScheduleRecommendedRefresh } from './types';

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
    networkIds: enableFetch ? recommendedNetworkIds : [],
    tagMatcher,
    onRefresh: enableFetch
      ? () => {
          scheduleRecommendedRefresh({ source: 'pending-tx' });
        }
      : undefined,
    onRefreshDelayMs: 0,
  });
}
