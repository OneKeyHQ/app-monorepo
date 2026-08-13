import { useCallback, useEffect, useRef, useState } from 'react';

function normalizeTradingViewSubIndicatorCount({
  count,
  maxCount,
}: {
  count: number;
  maxCount: number;
}) {
  if (!Number.isFinite(count)) {
    return 0;
  }
  return Math.min(maxCount, Math.max(0, Math.floor(count)));
}

export function useTradingViewSubIndicatorCount({
  chartKey,
  initialCount,
  maxCount,
  stabilizeInitialCount,
  stabilizationDelayMs,
  onCountSettled,
}: {
  chartKey: string;
  initialCount: number;
  maxCount: number;
  stabilizeInitialCount: boolean;
  stabilizationDelayMs: number;
  onCountSettled?: (count: number) => void;
}) {
  const normalizedInitialCount = normalizeTradingViewSubIndicatorCount({
    count: initialCount,
    maxCount,
  });
  const activeChartKeyRef = useRef(chartKey);
  activeChartKeyRef.current = chartKey;
  const stabilizedChartKeyRef = useRef<string | null>(
    stabilizeInitialCount ? null : chartKey,
  );
  const stabilizationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [subIndicatorState, setSubIndicatorState] = useState(() => ({
    key: chartKey,
    count: normalizedInitialCount,
  }));

  const cancelPendingStabilization = useCallback(() => {
    if (stabilizationTimerRef.current !== null) {
      clearTimeout(stabilizationTimerRef.current);
      stabilizationTimerRef.current = null;
    }
  }, []);

  const commitCount = useCallback(
    (
      targetChartKey: string,
      count: number,
      options?: { notifySettled?: boolean },
    ) => {
      if (activeChartKeyRef.current !== targetChartKey) {
        return;
      }

      setSubIndicatorState((prevState) =>
        prevState.key === targetChartKey && prevState.count === count
          ? prevState
          : { key: targetChartKey, count },
      );
      if (options?.notifySettled) {
        onCountSettled?.(count);
      }
    },
    [onCountSettled],
  );

  useEffect(() => {
    cancelPendingStabilization();
    stabilizedChartKeyRef.current = stabilizeInitialCount ? null : chartKey;

    return cancelPendingStabilization;
  }, [cancelPendingStabilization, chartKey, stabilizeInitialCount]);

  const handleSubIndicatorCountChange = useCallback(
    (count: number | null, options?: { layoutRestored?: boolean }) => {
      const targetChartKey = chartKey;
      if (activeChartKeyRef.current !== targetChartKey) {
        return;
      }

      const nextCount =
        count === null
          ? normalizedInitialCount
          : normalizeTradingViewSubIndicatorCount({ count, maxCount });

      if (count === null) {
        cancelPendingStabilization();
        stabilizedChartKeyRef.current = stabilizeInitialCount
          ? null
          : targetChartKey;
        commitCount(targetChartKey, nextCount);
        return;
      }

      if (
        !stabilizeInitialCount ||
        stabilizedChartKeyRef.current === targetChartKey
      ) {
        cancelPendingStabilization();
        commitCount(targetChartKey, nextCount, { notifySettled: true });
        return;
      }

      // Keep the app-provided initial height while the WebView restores its template.
      if (options?.layoutRestored === false) {
        return;
      }

      if (options?.layoutRestored) {
        cancelPendingStabilization();
        stabilizedChartKeyRef.current = targetChartKey;
        commitCount(targetChartKey, nextCount, { notifySettled: true });
        return;
      }

      // TradingView can publish a pre-layout snapshot before restoring saved studies.
      cancelPendingStabilization();
      stabilizationTimerRef.current = setTimeout(() => {
        stabilizationTimerRef.current = null;
        if (activeChartKeyRef.current !== targetChartKey) {
          return;
        }
        stabilizedChartKeyRef.current = targetChartKey;
        commitCount(targetChartKey, nextCount, { notifySettled: true });
      }, stabilizationDelayMs);
    },
    [
      cancelPendingStabilization,
      chartKey,
      commitCount,
      maxCount,
      normalizedInitialCount,
      stabilizationDelayMs,
      stabilizeInitialCount,
    ],
  );

  const subIndicatorCount =
    subIndicatorState.key === chartKey
      ? subIndicatorState.count
      : normalizedInitialCount;

  return [subIndicatorCount, handleSubIndicatorCountChange] as const;
}
