import { useEffect } from 'react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import type { IScheduleRecommendedRefresh } from './types';

export function useRecommendedRefreshSwapEvents({
  enableFetch,
  scheduleRecommendedRefresh,
}: {
  enableFetch: boolean;
  scheduleRecommendedRefresh: IScheduleRecommendedRefresh;
}) {
  useEffect(() => {
    if (!enableFetch) {
      return;
    }

    const handleSwapTxHistoryStatusUpdate = ({
      status,
    }: {
      status?: ESwapTxHistoryStatus;
    }) => {
      if (
        status !== ESwapTxHistoryStatus.SUCCESS &&
        status !== ESwapTxHistoryStatus.PARTIALLY_FILLED
      ) {
        return;
      }

      scheduleRecommendedRefresh({ source: 'app-event' });
    };

    appEventBus.on(
      EAppEventBusNames.SwapTxHistoryStatusUpdate,
      handleSwapTxHistoryStatusUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.SwapTxHistoryStatusUpdate,
        handleSwapTxHistoryStatusUpdate,
      );
    };
  }, [enableFetch, scheduleRecommendedRefresh]);
}
