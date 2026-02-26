import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_DURATION_SECONDS = 15;

type IUseQuoteCountdownParams = {
  enabled: boolean;
  durationSeconds?: number;
  onRefresh?: () => void;
};

type IUseQuoteCountdownReturn = {
  remainingSeconds: number;
  isExpired: boolean;
  reset: () => void;
  refresh: () => void;
};

export function useQuoteCountdown({
  enabled,
  durationSeconds = DEFAULT_DURATION_SECONDS,
  onRefresh,
}: IUseQuoteCountdownParams): IUseQuoteCountdownReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(durationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearTimer]);

  const reset = useCallback(() => {
    if (!enabled) return;
    setRemainingSeconds(durationSeconds);
    startTimer();
  }, [enabled, durationSeconds, startTimer]);

  const refresh = useCallback(() => {
    if (!enabled) return;
    setRemainingSeconds(durationSeconds);
    startTimer();
    onRefreshRef.current?.();
  }, [enabled, durationSeconds, startTimer]);

  // Start/stop timer based on enabled
  useEffect(() => {
    if (enabled) {
      setRemainingSeconds(durationSeconds);
      startTimer();
    } else {
      clearTimer();
      setRemainingSeconds(durationSeconds);
    }
    return clearTimer;
  }, [enabled, durationSeconds, startTimer, clearTimer]);

  const isExpired = enabled && remainingSeconds <= 0;

  return {
    remainingSeconds,
    isExpired,
    reset,
    refresh,
  };
}
