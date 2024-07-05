import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { debounce } from 'lodash';
import { AppState } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useDeferredPromise } from './useDeferredPromise';
import { useIsMounted } from './useIsMounted';

type IRunnerConfig = {
  triggerByDeps?: boolean; // true when trigger by deps changed, do not set it when manually trigger
  pollingNonce?: number;
  alwaysSetState?: boolean;
};

export type IPromiseResultOptions<T> = {
  initResult?: T; // TODO rename to initData
  watchLoading?: boolean; // make isLoading work, which cause more once render
  loadingDelay?: number;
  checkIsMounted?: boolean;
  checkIsFocused?: boolean;
  overrideIsFocused?: (isFocused: boolean) => boolean; // override the value of useIsFocused
  debounced?: number;
  undefinedResultIfError?: boolean;
  pollingInterval?: number;
  alwaysSetState?: boolean;
};

export type IUsePromiseResultReturn<T> = {
  result: T | undefined;
  isLoading: boolean | undefined;
  run: (config?: IRunnerConfig) => Promise<void>;
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
    const handleVisibilityStateChange = () => {
      const string = document.visibilityState;
      if (string === 'hidden') {
        resetDefer();
      } else if (string === 'visible') {
        resolveDefer();
      }
    };

    resolveDefer();
    if (platformEnv.isNative) {
      const subscription = AppState.addEventListener(
        'change',
        (nextAppState) => {
          if (nextAppState === 'active') {
            resolveDefer();
            return;
          }
          resetDefer();
        },
      );
      return () => {
        subscription.remove();
      };
    }
    document.addEventListener(
      'visibilitychange',
      handleVisibilityStateChange,
      false,
    );
    window.addEventListener('focus', resolveDefer);
    window.addEventListener('blur', resetDefer);
    return () => {
      document.removeEventListener(
        'visibilitychange',
        handleVisibilityStateChange,
        false,
      );
      window.removeEventListener('focus', resolveDefer);
      window.removeEventListener('blur', resetDefer);
    };
  }, [resetDefer, resolveDefer]);

  const [result, setResult] = useState<T | undefined>(
    options.initResult as any,
  );
  const [isLoading, setIsLoading] = useState<boolean | undefined>();
  const isMountedRef = useIsMounted();
  const _isFocused = useIsFocused();
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

  const run = useMemo(
    () => {
      const {
        watchLoading,
        loadingDelay,
        checkIsMounted,
        checkIsFocused,
        undefinedResultIfError,
        pollingInterval,
        alwaysSetState,
      } = optionsRef.current;

      const setLoadingTrue = () => {
        if (watchLoading) setIsLoading(true);
      };
      const setLoadingFalse = () => {
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

      const methodWithNonce = async ({ nonce }: { nonce: number }) => {
        const r = await methodRef?.current?.();
        return {
          r,
          nonce,
        };
      };

      const runner = async (config?: IRunnerConfig) => {
        if (config?.triggerByDeps && !isFocusedRef.current) {
          isDepsChangedOnBlur.current = true;
        }
        try {
          if (shouldSetState(config)) {
            setLoadingTrue();
            nonceRef.current += 1;
            const requestNonce = nonceRef.current;
            const { r, nonce } = await methodWithNonce({
              nonce: requestNonce,
            });
            if (shouldSetState(config) && nonceRef.current === nonce) {
              setResult(r);
            }
          }
        } catch (err) {
          if (shouldSetState(config) && undefinedResultIfError) {
            setResult(undefined);
          } else {
            throw err;
          }
        } finally {
          if (loadingDelay && watchLoading) {
            await timerUtils.wait(loadingDelay);
          }
          if (shouldSetState(config)) {
            setLoadingFalse();
          }
          if (
            pollingInterval &&
            pollingNonceRef.current === config?.pollingNonce
          ) {
            await timerUtils.wait(pollingInterval);
            await defer.promise;

            if (pollingNonceRef.current === config?.pollingNonce) {
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
          if (shouldSetState(config)) {
            setLoadingTrue();
          }
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

  useEffect(() => {
    pollingNonceRef.current += 1;
    void runRef.current({
      triggerByDeps: true,
      pollingNonce: pollingNonceRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const isFocusedRefValue = isFocusedRef.current;
  useEffect(() => {
    if (optionsRef.current.checkIsFocused) {
      if (isFocusedRefValue) {
        resolveDefer();
      } else {
        resetDefer();
      }
      if (isFocusedRefValue && isDepsChangedOnBlur.current) {
        isDepsChangedOnBlur.current = false;
        void runRef.current({ pollingNonce: pollingNonceRef.current });
      }
    }
  }, [isFocusedRefValue, resetDefer, resolveDefer]);

  return { result, isLoading, run };
}

export const useAsyncCall = usePromiseResult;
export const useAsyncResult = usePromiseResult;
export const useAsyncData = usePromiseResult;
