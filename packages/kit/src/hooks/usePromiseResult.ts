import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { debounce, isEmpty } from 'lodash';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
  useDeferredPromise,
  useNetInfo,
} from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { swrCacheUtils } from '@onekeyhq/shared/src/utils/swrCacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useIsMounted } from './useIsMounted';
import { usePrevious } from './usePrevious';

type IRunnerConfig = {
  triggerByDeps?: boolean; // true when trigger by deps changed, do not set it when manually trigger
  pollingNonce?: number;
  alwaysSetState?: boolean;
};

export type IPromiseResultOptions<T> = {
  initResult?: T; // TODO rename to initData
  // make isLoading work, which cause more once render, use onIsLoadingChange+jotai for better performance
  watchLoading?: boolean;
  loadingDelay?: number;
  checkIsMounted?: boolean;
  checkIsFocused?: boolean;
  overrideIsFocused?: (isFocused: boolean) => boolean; // override the value of useIsFocused
  debounced?: number;
  undefinedResultIfError?: boolean;
  undefinedResultIfReRun?: boolean;
  pollingInterval?: number;
  alwaysSetState?: boolean;
  onIsLoadingChange?: (isLoading: boolean) => void;
  // automatically revalidate when Page gets focused
  revalidateOnFocus?: boolean;
  // automatically revalidate when the browser regains a network connection
  revalidateOnReconnect?: boolean;
  testID?: string;
  /**
   * When set, enables stale-while-revalidate:
   * - On mount: sync-reads cached value from MMKV as initResult
   * - On success: writes fresh result to MMKV cache
   * - The real async request always fires (cache never blocks)
   */
  swrKey?: string;
};

export type IUsePromiseResultReturn<T> = {
  result: T | undefined;
  setResult: React.Dispatch<React.SetStateAction<T | undefined>>;
  isLoading: boolean | undefined;
  run: (config?: IRunnerConfig) => Promise<void>;
  // Pause future polling ticks until deps change (or set back to false). The
  // current run still completes; only the scheduled next tick is skipped.
  // Returns true when calling setStopPolling(false) resurrected a paused
  // polling chain and triggered a fresh run, so callers can avoid issuing a
  // duplicate run().
  setStopPolling: (stop: boolean) => boolean;
};

export type IUsePromiseResultReturnWithInitValue<T> =
  IUsePromiseResultReturn<T> & {
    result: T;
  };

export function usePromiseResult<T>(
  method: () => Promise<T>,
  deps: any[],
  options: { initResult: T } & IPromiseResultOptions<T>,
): IUsePromiseResultReturnWithInitValue<T>;

export function usePromiseResult<T>(
  method: () => Promise<T>,
  deps: any[],
  options?: IPromiseResultOptions<T>,
): IUsePromiseResultReturn<T>;

export function usePromiseResult<T>(
  method: () => Promise<T>,
  deps: any[] = [],
  options: IPromiseResultOptions<T> = {},
): IUsePromiseResultReturn<T> {
  const defer = useDeferredPromise();

  const resolveDefer = useCallback(() => {
    defer.resolve(null);
  }, [defer]);

  const resetDefer = useCallback(() => {
    defer.reset();
  }, [defer]);

  useEffect(() => {
    const handleVisibilityStateChange = (visible: boolean) => {
      if (visible) {
        resolveDefer();
      } else {
        resetDefer();
      }
    };
    handleVisibilityStateChange(getCurrentVisibilityState());
    const removeSubscription = onVisibilityStateChange(
      handleVisibilityStateChange,
    );
    return removeSubscription;
  }, [resetDefer, resolveDefer]);

  // --- SWR: resolve initial value from sync cache ---
  const swrKey = options.swrKey;
  const swrKeyRef = useRef(swrKey);
  swrKeyRef.current = swrKey;
  const swrCacheEntry = useMemo(() => {
    if (!swrKey) return undefined;
    return swrCacheUtils.getWithTimestamp<T>(swrKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swrKey]);
  // swrKey cache hit always has higher priority than initResult.
  const effectiveInitResult =
    swrCacheEntry !== undefined ? swrCacheEntry.data : options.initResult;

  const [result, setResult] = useState<T | undefined>(
    effectiveInitResult as any,
  );

  // When `swrKey` identifies cross-account/wallet scope (e.g. walletId or
  // networkId baked into the key), switching scope would leave `result`
  // holding the previous scope's data until the async revalidation lands,
  // causing a flash of wrong-identity data. Sync state during render so
  // the new scope's cached value (or its initResult) becomes visible
  // immediately. `useState` initializer only runs on mount, so we cannot
  // rely on `effectiveInitResult` alone.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [prevSwrKey, setPrevSwrKey] = useState(swrKey);
  if (swrKey !== prevSwrKey) {
    setPrevSwrKey(swrKey);
    if (swrKey !== undefined) {
      setResult(
        (swrCacheEntry !== undefined
          ? swrCacheEntry.data
          : options.initResult) as any,
      );
    } else {
      // key→undefined: no cache to read, reset to default
      setResult(options.initResult as any);
    }
  }
  const isEmptyResultRef = useRef<boolean>(true);

  if (platformEnv.isNative) {
    isEmptyResultRef.current = isEmpty(result);
  }
  const [isLoading, setIsLoading] = useState<boolean | undefined>();
  const isMountedRef = useIsMounted();
  const _isFocused = useIsFocused({ testID: options.testID });
  const isFocusedRef = useRef<boolean>(_isFocused);
  const pollingNonceRef = useRef<number>(0);
  isFocusedRef.current = _isFocused;
  if (options?.overrideIsFocused !== undefined) {
    isFocusedRef.current = options?.overrideIsFocused?.(_isFocused);
  }
  const methodRef = useRef<typeof method>(method);
  methodRef.current = method;
  const optionsRef = useRef(options);
  optionsRef.current = {
    watchLoading: false,
    loadingDelay: 0,
    checkIsMounted: true,
    checkIsFocused: true,
    alwaysSetState: false,
    ...options,
  };
  const isDepsChangedOnBlur = useRef(false);
  const nonceRef = useRef(0);

  // The polling continuation in the finally-block reads this synchronously,
  // so a ref is enough — no consumer reacts to the flag via React state, and
  // adding a state would only churn renders without changing behavior.
  const stopPollingRef = useRef(false);

  const isEffectValid = useRef(true);

  const run = useMemo(
    () => {
      const {
        watchLoading,
        loadingDelay,
        checkIsMounted,
        checkIsFocused,
        undefinedResultIfError,
        alwaysSetState,
      } = optionsRef.current;

      const setLoadingTrue = () => {
        optionsRef.current.onIsLoadingChange?.(true);
        if (watchLoading) setIsLoading(true);
      };
      const setLoadingFalse = () => {
        optionsRef.current.onIsLoadingChange?.(false);
        if (watchLoading) setIsLoading(false);
      };
      const shouldSetState = (config?: IRunnerConfig) => {
        let flag = true;
        if (checkIsMounted && !isMountedRef.current) {
          flag = false;
        }
        if (checkIsFocused && !isFocusedRef.current) {
          flag = false;
        }

        if (alwaysSetState || config?.alwaysSetState) {
          flag = true;
        }
        return flag;
      };

      // Focus is only relevant for deciding whether to *start* a fetch (and
      // for surfacing loading UI). Once a fetch is in flight, its result
      // must always be applied — dropping it on blur loses data with no
      // recovery path when neither `revalidateOnFocus` is set nor deps
      // change during blur. Mount check still applies to avoid setState on
      // an unmounted component.
      const shouldApplyResult = (config?: IRunnerConfig) => {
        let flag = true;
        if (checkIsMounted && !isMountedRef.current) {
          flag = false;
        }
        if (alwaysSetState || config?.alwaysSetState) {
          flag = true;
        }
        return flag;
      };

      const methodWithNonce = async ({ nonce }: { nonce: number }) => {
        const r = await methodRef?.current?.();
        return {
          r,
          nonce,
        };
      };

      const runner = async (config?: IRunnerConfig) => {
        if (!isEffectValid.current) {
          return;
        }
        const { pollingInterval } = optionsRef.current;
        if (config?.triggerByDeps && !isFocusedRef.current) {
          isDepsChangedOnBlur.current = true;
          // Deps changed but the new run was blocked by the focus gate,
          // so we never minted a fresh nonce for the new scope. Bump
          // here to invalidate any in-flight request from the previous
          // scope — otherwise its stale result would still satisfy
          // `shouldApplyResult` (mount-only) and overwrite the new
          // scope's init / cached state until refocus re-fetches.
          nonceRef.current += 1;
        }
        // Track outside the try-block so catch / finally can decide
        // whether THIS runner started a request, which swrKey scope it
        // dispatched under, and which nonce it owns. Without these,
        // focus-gated no-op runners would still emit phantom loading
        // transitions, stale resolutions would clear a newer request's
        // loading, and error-path resets would land on the wrong scope.
        let didStartRequest = false;
        let requestNonce: number | null = null;
        let capturedSwrKey: string | undefined;
        try {
          if (shouldSetState(config)) {
            didStartRequest = true;
            // Capture swrKey at dispatch time. If it changes mid-flight
            // (e.g. user switches wallet/account), we must NOT land
            // this result on the new scope — neither into its render
            // state nor into its cache slot.
            capturedSwrKey = swrKeyRef.current;
            if (optionsRef.current.undefinedResultIfReRun) {
              setResult(undefined);
            }
            setLoadingTrue();
            nonceRef.current += 1;
            requestNonce = nonceRef.current;
            const { r, nonce } = await methodWithNonce({
              nonce: requestNonce,
            });
            // swrKey may change without bumping deps (it is not part of
            // runnerDeps). Compare the captured key against the latest
            // before landing — otherwise an in-flight result from the
            // previous scope would overwrite the new scope's render-time
            // setResult swap.
            if (
              shouldApplyResult(config) &&
              nonceRef.current === nonce &&
              capturedSwrKey === swrKeyRef.current
            ) {
              setResult(r);
              // Only persist if the result is defined — writing
              // `undefined` would later override the caller's explicit
              // initResult on next mount. (Scope identity is already
              // guaranteed by the outer check.)
              if (capturedSwrKey && r !== undefined) {
                swrCacheUtils.set(capturedSwrKey, r);
              }
            }
          }
        } catch (err) {
          // AbortError is expected when IndexedDB transactions are cancelled
          // (e.g., when component unmount or tab switches during search)
          // Treat it as a non-critical error and don't re-throw
          const isAbortError =
            typeof DOMException !== 'undefined' &&
            err instanceof DOMException &&
            err.name === 'AbortError';

          // A request the consumer has abandoned must not touch the
          // current scope: it cannot reset the result, and re-throwing
          // its error would surface a failure that no longer applies to
          // anyone. Two ways a request goes stale, both mirroring the
          // success path's gate:
          //   - swrKey changed mid-flight (e.g. wallet/account switch).
          //   - a newer request superseded this one (deps changed and
          //     bumped nonceRef without changing swrKey). Without the
          //     nonce check, request 1's `undefinedResultIfError` /
          //     AbortError reset would clobber request 2's fresh result
          //     or prematurely clear a still-pending newer scope.
          const isStale =
            didStartRequest &&
            (capturedSwrKey !== swrKeyRef.current ||
              (requestNonce !== null && nonceRef.current !== requestNonce));

          if (isStale) {
            // Swallow: scope/nonce identity check (same as success path)
            // and suppressed re-throw mirror how AbortError is already
            // treated as non-critical.
          } else if (
            didStartRequest &&
            shouldApplyResult(config) &&
            (undefinedResultIfError || isAbortError)
          ) {
            // Mirror the success-path gate: callers that opted into
            // `undefinedResultIfError` expect the reset to land
            // regardless of focus. Without this, a blur-time rejection
            // silently keeps stale data and re-throws as an unhandled
            // rejection.
            setResult(undefined);
          } else if (!isAbortError) {
            throw err;
          }
        } finally {
          if (loadingDelay && watchLoading) {
            await timerUtils.wait(loadingDelay);
          }
          // Loading state must travel with `setResult`: clear only when
          // THIS runner started a request AND it is still the latest
          // nonce. A focus-gated no-op runner never called
          // setLoadingTrue (so an unpaired (false) would be phantom),
          // and a stale runner clearing here would flicker isLoading
          // off while a newer in-flight request is still pending.
          if (
            didStartRequest &&
            shouldApplyResult(config) &&
            requestNonce !== null &&
            nonceRef.current === requestNonce
          ) {
            setLoadingFalse();
          }
          if (
            pollingInterval &&
            pollingNonceRef.current === config?.pollingNonce &&
            !stopPollingRef.current
          ) {
            await timerUtils.wait(pollingInterval);
            await defer.promise;
            if (
              pollingNonceRef.current === config?.pollingNonce &&
              !stopPollingRef.current
            ) {
              if (shouldSetState(config)) {
                void run({
                  triggerByDeps: true,
                  pollingNonce: config.pollingNonce,
                });
              } else {
                isDepsChangedOnBlur.current = true;
              }
            }
          }
        }
      };

      if (optionsRef.current.debounced) {
        const runnerDebounced = debounce(runner, optionsRef.current.debounced, {
          leading: false,
          trailing: true,
        });
        return async (config?: IRunnerConfig) => {
          // Loading transitions are owned by the inner runner: setting
          // setLoadingTrue here would leak `isLoading=true` if the
          // route blurred during the debounce window and the runner
          // later hit the focus gate (no `didStartRequest` → no paired
          // setLoadingFalse in finally). Letting the runner emit
          // setLoadingTrue when it actually starts also matches what
          // debounced callers want: no loading flicker on every
          // keystroke, only when the request truly fires.
          await runnerDebounced(config);
        };
      }

      return runner;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runRef = useRef(run);
  runRef.current = run;

  const setStopPolling = useCallback((stop: boolean) => {
    const wasStopped = stopPollingRef.current;
    stopPollingRef.current = stop;
    // Stopped → not stopped: the previous polling chain already exited via
    // the finally-block guard once stopPollingRef flipped true, so clearing
    // the flag alone won't bring it back. Bump the nonce and run with it —
    // mirrors the runnerDeps effect — so the loop actually resumes; the
    // bump also invalidates any stale queued tick that might still race.
    if (wasStopped && !stop && optionsRef.current.pollingInterval) {
      pollingNonceRef.current += 1;
      void runRef.current({
        triggerByDeps: true,
        pollingNonce: pollingNonceRef.current,
      });
      return true;
    }
    return false;
  }, []);

  const runnerDeps = useMemo(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    () => [...deps, optionsRef.current.pollingInterval],
    [deps],
  );

  const runAtRef = useRef(0);
  const prevPollingInterval = usePrevious(optionsRef.current.pollingInterval);
  useEffect(() => {
    const callback = () => {
      // Deps changed (or polling interval changed) means the input is no
      // longer the one the server-side stop applied to — auto-resume so the
      // next attempt actually fires.
      stopPollingRef.current = false;
      runAtRef.current = Date.now();
      pollingNonceRef.current += 1;
      void runRef.current({
        triggerByDeps: true,
        pollingNonce: pollingNonceRef.current,
      });
    };
    // execute immediately when the timer has not changed.
    if (prevPollingInterval === optionsRef.current.pollingInterval) {
      callback();
      // the interval duration of the call needs to be readjusted after the polling interval duration changes。
    } else {
      setTimeout(
        callback,
        Date.now() - runAtRef.current >
          (optionsRef.current.pollingInterval || 0)
          ? 0
          : optionsRef.current.pollingInterval,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, runnerDeps);

  const isFocusedRefValue = isFocusedRef.current;
  const prevFocusedRef = useRef(isFocusedRefValue);
  const isLoadingRef = useRef(isLoading);
  const runWithPollingNonce = useCallback(() => {
    isDepsChangedOnBlur.current = false;
    void runRef.current({ pollingNonce: pollingNonceRef.current });
  }, [runRef]);

  // Most callers don't need reconnect revalidation. Avoid subscribing them
  // to global network polling updates, which can cause periodic rerenders.
  const { isRawInternetReachable: isInternetReachable } = useNetInfo(
    !!options.revalidateOnReconnect,
  );
  const prevIsInternetReachableRef = useRef(isInternetReachable);

  useEffect(() => {
    if (optionsRef.current.revalidateOnReconnect) {
      if (prevIsInternetReachableRef.current === false && isInternetReachable) {
        runWithPollingNonce();
      }
      prevIsInternetReachableRef.current = isInternetReachable;
    }
  }, [isInternetReachable, runWithPollingNonce]);

  useEffect(() => {
    if (optionsRef.current.checkIsFocused) {
      if (isFocusedRefValue) {
        resolveDefer();
      } else {
        resetDefer();
      }

      // On native, defer focus-recovery re-execution until the JS thread is
      // idle so the first render frame after tab switch can paint without
      // being blocked by data fetching across 40+ hooks.
      const idleHandles: ReturnType<typeof requestIdleCallback>[] = [];
      const scheduleRun = () => {
        if (platformEnv.isNative) {
          idleHandles.push(requestIdleCallback(runWithPollingNonce));
        } else {
          runWithPollingNonce();
        }
      };

      // By employing a hack to simulate the recovery from a network disconnection and subsequently make a new network request.
      if (
        platformEnv.isNative &&
        !isLoadingRef.current &&
        isEmptyResultRef.current &&
        optionsRef.current.revalidateOnReconnect
      ) {
        scheduleRun();
      }

      if (
        prevFocusedRef.current === false &&
        isFocusedRefValue &&
        optionsRef.current.revalidateOnFocus
      ) {
        scheduleRun();
      } else if (isFocusedRefValue && isDepsChangedOnBlur.current) {
        scheduleRun();
      }
      prevFocusedRef.current = isFocusedRefValue;

      return () => {
        if (platformEnv.isNative) {
          idleHandles.forEach(cancelIdleCallback);
        }
      };
    }
  }, [isFocusedRefValue, resetDefer, resolveDefer, runWithPollingNonce]);

  useEffect(() => {
    return () => {
      isEffectValid.current = false;
    };
  }, []);

  return { result, isLoading, run, setResult, setStopPolling };
}

export const useAsyncCall = usePromiseResult;
export const useAsyncResult = usePromiseResult;
export const useAsyncData = usePromiseResult;
