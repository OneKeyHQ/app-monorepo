import { useCallback, useEffect, useRef } from 'react';

import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import type { IRefreshSource, IScheduleRecommendedRefresh } from './types';

const RECOMMENDED_REFRESH_DELAY = timerUtils.getTimeDurationMs({
  seconds: 3,
});

const RECOMMENDED_REFRESH_DEDUP_WINDOW = timerUtils.getTimeDurationMs({
  seconds: 5,
});

const REFRESH_DELAY_BY_SOURCE: Record<IRefreshSource, number> = {
  'app-event': RECOMMENDED_REFRESH_DELAY,
  'pending-tx': RECOMMENDED_REFRESH_DELAY,
};

export function useRecommendedRefreshScheduler({
  onRefresh,
}: {
  onRefresh: () => Promise<void>;
}) {
  const isFocused = useIsFocused();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledRefreshAtRef = useRef<number | null>(null);
  const pendingRefreshAtRef = useRef<number | null>(null);
  const lastRefreshAtRef = useRef(0);

  const clearScheduledRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    scheduledRefreshAtRef.current = null;
  }, []);

  const runRecommendedRefresh = useCallback(async () => {
    clearScheduledRefresh();
    pendingRefreshAtRef.current = null;
    lastRefreshAtRef.current = Date.now();

    await onRefresh();
  }, [clearScheduledRefresh, onRefresh]);

  const scheduleRecommendedRefresh = useCallback<IScheduleRecommendedRefresh>(
    ({ source = 'app-event', delayMs } = {}) => {
      const resolvedDelay = delayMs ?? REFRESH_DELAY_BY_SOURCE[source];
      const now = Date.now();
      const targetAt = Math.max(
        now + resolvedDelay,
        lastRefreshAtRef.current + RECOMMENDED_REFRESH_DEDUP_WINDOW,
      );

      if (!isFocused) {
        pendingRefreshAtRef.current = Math.max(
          pendingRefreshAtRef.current ?? 0,
          targetAt,
        );
        return;
      }

      if (scheduledRefreshAtRef.current === targetAt) {
        return;
      }

      clearScheduledRefresh();
      scheduledRefreshAtRef.current = targetAt;
      refreshTimerRef.current = setTimeout(
        () => {
          refreshTimerRef.current = null;
          scheduledRefreshAtRef.current = null;
          void runRecommendedRefresh();
        },
        Math.max(0, targetAt - Date.now()),
      );
    },
    [clearScheduledRefresh, isFocused, runRecommendedRefresh],
  );

  useEffect(() => {
    if (!isFocused || pendingRefreshAtRef.current === null) {
      return;
    }

    const pendingAt = pendingRefreshAtRef.current;
    pendingRefreshAtRef.current = null;
    scheduleRecommendedRefresh({
      delayMs: Math.max(0, pendingAt - Date.now()),
    });
  }, [isFocused, scheduleRecommendedRefresh]);

  useEffect(
    () => () => {
      clearScheduledRefresh();
    },
    [clearScheduledRefresh],
  );

  return {
    scheduleRecommendedRefresh,
  };
}
