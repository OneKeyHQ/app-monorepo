import { useCallback, useEffect, useRef, useState } from 'react';

function normalizeTradingViewSubIndicatorCount(count: number) {
  if (!Number.isFinite(count)) {
    return 0;
  }
  return Math.max(0, Math.floor(count));
}

export function useTradingViewSubIndicatorCount({
  chartKey,
  defaultCount,
  stabilizeInitialCount,
  stabilizationDelayMs,
}: {
  chartKey: string;
  defaultCount: number;
  stabilizeInitialCount: boolean;
  stabilizationDelayMs: number;
}) {
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
    count: defaultCount,
  }));

  const cancelPendingStabilization = useCallback(() => {
    if (stabilizationTimerRef.current !== null) {
      clearTimeout(stabilizationTimerRef.current);
      stabilizationTimerRef.current = null;
    }
  }, []);

  const commitCount = useCallback((targetChartKey: string, count: number) => {
    if (activeChartKeyRef.current !== targetChartKey) {
      return;
    }

    setSubIndicatorState((prevState) =>
      prevState.key === targetChartKey && prevState.count === count
        ? prevState
        : { key: targetChartKey, count },
    );
  }, []);

  useEffect(() => {
    cancelPendingStabilization();
    stabilizedChartKeyRef.current = stabilizeInitialCount ? null : chartKey;

    return cancelPendingStabilization;
  }, [cancelPendingStabilization, chartKey, stabilizeInitialCount]);

  const handleSubIndicatorCountChange = useCallback(
    (count: number | null) => {
      const targetChartKey = chartKey;
      if (activeChartKeyRef.current !== targetChartKey) {
        return;
      }

      const nextCount =
        count === null
          ? defaultCount
          : normalizeTradingViewSubIndicatorCount(count);

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
        commitCount(targetChartKey, nextCount);
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
        commitCount(targetChartKey, nextCount);
      }, stabilizationDelayMs);
    },
    [
      cancelPendingStabilization,
      chartKey,
      commitCount,
      defaultCount,
      stabilizationDelayMs,
      stabilizeInitialCount,
    ],
  );

  const subIndicatorCount =
    subIndicatorState.key === chartKey ? subIndicatorState.count : defaultCount;

  return [subIndicatorCount, handleSubIndicatorCountChange] as const;
}
