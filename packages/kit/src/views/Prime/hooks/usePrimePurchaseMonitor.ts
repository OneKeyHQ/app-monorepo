import { useCallback, useEffect, useRef, useState } from 'react';

import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/shared/src/utils/appVisibility';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const POLL_BACKOFF_MULTIPLIERS = [1, 2, 4, 6] as const;

export type IPrimePurchaseMonitorIssue = {
  reason: string;
  error?: unknown;
};

export type IPrimePurchaseMonitorPollResult<
  TData,
  TTerminalReason extends string,
> =
  | {
      status: 'pending';
      data?: TData;
      issue?: IPrimePurchaseMonitorIssue;
    }
  | {
      status: 'succeeded';
      data?: TData;
      issue?: IPrimePurchaseMonitorIssue;
    }
  | {
      status: 'terminal';
      reason: TTerminalReason;
      data?: TData;
      issue?: IPrimePurchaseMonitorIssue;
    };

export type IPrimePurchaseMonitorAdapter<
  TData,
  TTerminalReason extends string,
> = ({
  data,
}: {
  data: TData | undefined;
}) => Promise<IPrimePurchaseMonitorPollResult<TData, TTerminalReason>>;

export type IPrimePurchaseMonitorEvent<TData> =
  | {
      type: 'started' | 'refreshed' | 'timedOut';
      data: TData | undefined;
    }
  | {
      type: 'failed';
      data: TData | undefined;
      issue: IPrimePurchaseMonitorIssue;
      retryCount: number;
    }
  | {
      type: 'recovered';
      data: TData | undefined;
      retryCount: number;
    };

export type IPrimePurchaseMonitorRefreshResult =
  | 'pending'
  | 'succeeded'
  | 'terminal'
  | 'failed'
  | 'cancelled';

type IRefreshWaiter = (result: IPrimePurchaseMonitorRefreshResult) => void;

function getPollDelayMs({
  pollIntervalMs,
  consecutiveFailureCount,
}: {
  pollIntervalMs: number;
  consecutiveFailureCount: number;
}) {
  const multiplierIndex = Math.min(
    Math.max(consecutiveFailureCount - 1, 0),
    POLL_BACKOFF_MULTIPLIERS.length - 1,
  );
  return pollIntervalMs * POLL_BACKOFF_MULTIPLIERS[multiplierIndex];
}

export function usePrimePurchaseMonitor<TData, TTerminalReason extends string>({
  sessionKey,
  initialData,
  enabled,
  adapter,
  onSuccess,
  onTerminal,
  onEvent,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  timeoutMs,
}: {
  sessionKey: string;
  initialData?: TData;
  enabled: boolean;
  adapter: IPrimePurchaseMonitorAdapter<TData, TTerminalReason>;
  onSuccess: (data: TData | undefined) => void | Promise<void>;
  onTerminal: (
    reason: TTerminalReason,
    data: TData | undefined,
  ) => void | Promise<void>;
  onEvent?: (event: IPrimePurchaseMonitorEvent<TData>) => void;
  pollIntervalMs?: number;
  timeoutMs?: number;
}) {
  const isRouteFocused = useRouteIsFocused();
  const [data, setData] = useState(initialData);
  const [isPolling, setIsPolling] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isTimedOut, setIsTimedOut] = useState(false);

  const generationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const inFlightRef = useRef<
    | {
        generation: number;
        waiters: IRefreshWaiter[];
      }
    | undefined
  >(undefined);
  const pendingImmediateGenerationRef = useRef<number | undefined>(undefined);
  const pendingImmediateIsManualRef = useRef(false);
  const pendingRefreshWaitersRef = useRef<IRefreshWaiter[]>([]);
  const terminalGenerationRef = useRef<number | undefined>(undefined);
  const timedOutGenerationRef = useRef<number | undefined>(undefined);
  const consecutiveFailureCountRef = useRef(0);
  const dataRef = useRef(initialData);
  const requestPollRef = useRef<({ manual }?: { manual?: boolean }) => void>(
    () => undefined,
  );
  const previousRouteFocusedRef = useRef(isRouteFocused);
  const propsRef = useRef({
    initialData,
    enabled,
    adapter,
    onSuccess,
    onTerminal,
    onEvent,
    pollIntervalMs,
    timeoutMs,
  });
  propsRef.current = {
    initialData,
    enabled,
    adapter,
    onSuccess,
    onTerminal,
    onEvent,
    pollIntervalMs,
    timeoutMs,
  };

  const emitEvent = useCallback((event: IPrimePurchaseMonitorEvent<TData>) => {
    try {
      propsRef.current.onEvent?.(event);
    } catch {
      // Observability must never control the purchase monitor lifecycle.
    }
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const clearTimeoutTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const resolveWaiters = useCallback(
    (waiters: IRefreshWaiter[], result: IPrimePurchaseMonitorRefreshResult) => {
      waiters.forEach((resolve) => resolve(result));
    },
    [],
  );

  const cancelGenerationWaiters = useCallback(
    (generation: number) => {
      resolveWaiters(pendingRefreshWaitersRef.current.splice(0), 'cancelled');
      if (inFlightRef.current?.generation === generation) {
        resolveWaiters(inFlightRef.current.waiters, 'cancelled');
        inFlightRef.current = undefined;
      }
    },
    [resolveWaiters],
  );

  const requestPoll = useCallback(
    ({ manual = false }: { manual?: boolean } = {}) => {
      const generation = generationRef.current;
      const currentProps = propsRef.current;
      if (
        !currentProps.enabled ||
        terminalGenerationRef.current === generation ||
        (timedOutGenerationRef.current === generation && !manual)
      ) {
        return;
      }

      clearTimer();
      if (inFlightRef.current?.generation === generation) {
        pendingImmediateGenerationRef.current = generation;
        pendingImmediateIsManualRef.current =
          pendingImmediateIsManualRef.current || manual;
        return;
      }

      const requestToken = {
        generation,
        waiters: pendingRefreshWaitersRef.current.splice(0),
      };
      inFlightRef.current = requestToken;
      setIsPolling(true);
      let completionResult: IPrimePurchaseMonitorRefreshResult = 'failed';
      let failureRecorded = false;

      const recordIssue = (issue: IPrimePurchaseMonitorIssue) => {
        if (consecutiveFailureCountRef.current === 0) {
          emitEvent({
            type: 'failed',
            data: dataRef.current,
            issue,
            retryCount: 1,
          });
        }
        consecutiveFailureCountRef.current += 1;
        failureRecorded = true;
        setHasError(true);
      };

      void (async () => {
        const pollResult = await currentProps.adapter({
          data: dataRef.current,
        });
        if (generationRef.current !== generation) {
          completionResult = 'cancelled';
          return;
        }

        if (pollResult.data !== undefined) {
          dataRef.current = pollResult.data;
          setData(pollResult.data);
        }

        if (pollResult.issue) {
          recordIssue(pollResult.issue);
        } else {
          if (consecutiveFailureCountRef.current > 0) {
            emitEvent({
              type: 'recovered',
              data: dataRef.current,
              retryCount: consecutiveFailureCountRef.current,
            });
          }
          consecutiveFailureCountRef.current = 0;
          setHasError(false);
        }

        if (pollResult.status === 'pending') {
          completionResult = pollResult.issue ? 'failed' : 'pending';
          return;
        }

        terminalGenerationRef.current = generation;
        try {
          if (pollResult.status === 'succeeded') {
            await propsRef.current.onSuccess(dataRef.current);
            completionResult = 'succeeded';
          } else {
            await propsRef.current.onTerminal(
              pollResult.reason,
              dataRef.current,
            );
            completionResult = 'terminal';
          }
        } catch (error) {
          if (generationRef.current === generation) {
            terminalGenerationRef.current = undefined;
            if (!failureRecorded) {
              recordIssue({
                reason:
                  pollResult.status === 'succeeded'
                    ? 'successHandlerFailed'
                    : 'terminalHandlerFailed',
                error,
              });
            }
          }
          completionResult = 'failed';
        }
      })()
        .catch((error) => {
          if (generationRef.current === generation) {
            if (!failureRecorded) {
              recordIssue({ reason: 'adapterFailed', error });
            }
            completionResult = 'failed';
          } else {
            completionResult = 'cancelled';
          }
        })
        .finally(() => {
          resolveWaiters(requestToken.waiters, completionResult);
          if (inFlightRef.current !== requestToken) {
            return;
          }
          inFlightRef.current = undefined;
          if (generationRef.current !== generation) {
            return;
          }
          setIsPolling(false);

          if (terminalGenerationRef.current === generation) {
            resolveWaiters(
              pendingRefreshWaitersRef.current.splice(0),
              completionResult,
            );
            return;
          }

          if (pendingImmediateGenerationRef.current === generation) {
            pendingImmediateGenerationRef.current = undefined;
            const isManual = pendingImmediateIsManualRef.current;
            pendingImmediateIsManualRef.current = false;
            requestPollRef.current({ manual: isManual });
            return;
          }

          if (timedOutGenerationRef.current === generation) {
            return;
          }

          timerRef.current = setTimeout(
            () => {
              timerRef.current = undefined;
              if (getCurrentVisibilityState()) {
                requestPollRef.current();
              }
            },
            getPollDelayMs({
              pollIntervalMs: propsRef.current.pollIntervalMs,
              consecutiveFailureCount: consecutiveFailureCountRef.current,
            }),
          );
        });
    },
    [clearTimer, emitEvent, resolveWaiters],
  );
  requestPollRef.current = requestPoll;

  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    terminalGenerationRef.current = undefined;
    timedOutGenerationRef.current = undefined;
    pendingImmediateGenerationRef.current = undefined;
    pendingImmediateIsManualRef.current = false;
    consecutiveFailureCountRef.current = 0;
    dataRef.current = propsRef.current.initialData;
    setData(propsRef.current.initialData);
    setIsPolling(false);
    setHasError(false);
    setIsTimedOut(false);
    clearTimer();
    clearTimeoutTimer();

    if (enabled) {
      emitEvent({ type: 'started', data: dataRef.current });
      requestPollRef.current();
      if (timeoutMs !== undefined && timeoutMs > 0) {
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = undefined;
          if (
            generationRef.current !== generation ||
            terminalGenerationRef.current === generation
          ) {
            return;
          }
          timedOutGenerationRef.current = generation;
          clearTimer();
          setIsTimedOut(true);
          emitEvent({ type: 'timedOut', data: dataRef.current });
        }, timeoutMs);
      }
    }

    return () => {
      if (generationRef.current === generation) {
        generationRef.current += 1;
      }
      clearTimer();
      clearTimeoutTimer();
      cancelGenerationWaiters(generation);
    };
  }, [
    cancelGenerationWaiters,
    clearTimer,
    clearTimeoutTimer,
    emitEvent,
    enabled,
    resolveWaiters,
    sessionKey,
    timeoutMs,
  ]);

  useEffect(() => {
    const wasFocused = previousRouteFocusedRef.current;
    previousRouteFocusedRef.current = isRouteFocused;
    if (!wasFocused && isRouteFocused && enabled) {
      requestPollRef.current();
    }
  }, [enabled, isRouteFocused]);

  useEffect(
    () =>
      onVisibilityStateChange((visible) => {
        if (visible && propsRef.current.enabled) {
          requestPollRef.current();
        }
      }),
    [],
  );

  const refresh = useCallback(() => {
    const generation = generationRef.current;
    if (
      !propsRef.current.enabled ||
      terminalGenerationRef.current === generation
    ) {
      return Promise.resolve<IPrimePurchaseMonitorRefreshResult>('cancelled');
    }
    emitEvent({ type: 'refreshed', data: dataRef.current });
    return new Promise<IPrimePurchaseMonitorRefreshResult>((resolve) => {
      pendingRefreshWaitersRef.current.push(resolve);
      requestPollRef.current({ manual: true });
    });
  }, [emitEvent]);

  return {
    data,
    isPolling,
    hasError,
    isTimedOut,
    refresh,
  };
}
