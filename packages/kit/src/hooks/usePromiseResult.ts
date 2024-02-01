import { useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { debounce } from 'lodash';

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { useIsMounted } from './useIsMounted';

type IRunnerConfig = {
  triggerByDeps?: boolean; // true when trigger by deps changed, do not set it when manually trigger
};

export type IPromiseResultOptions<T> = {
  initResult?: T; // TODO rename to initData
  watchLoading?: boolean; // make isLoading work, which cause more once render
  loadingDelay?: number;
  checkIsMounted?: boolean;
  checkIsFocused?: boolean;
  debounced?: number;
  undefinedResultIfError?: boolean;
  pollingInterval?: number;
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
  const [result, setResult] = useState<T | undefined>(
    options.initResult as any,
  );
  const [isLoading, setIsLoading] = useState<boolean | undefined>();
  const isMountedRef = useIsMounted();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef<boolean>(isFocused);
  isFocusedRef.current = isFocused;
  const methodRef = useRef<typeof method>(method);
  methodRef.current = method;
  const optionsRef = useRef(options);
  optionsRef.current = {
    watchLoading: false,
    loadingDelay: 0,
    checkIsMounted: true,
    checkIsFocused: true,
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
      } = optionsRef.current;

      const setLoadingTrue = () => {
        if (watchLoading) setIsLoading(true);
      };
      const setLoadingFalse = () => {
        if (watchLoading) setIsLoading(false);
      };
      const shouldSetState = () => {
        let flag = true;
        if (checkIsMounted && !isMountedRef.current) {
          flag = false;
        }
        if (checkIsFocused && !isFocusedRef.current) {
          flag = false;
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
          if (shouldSetState()) {
            setLoadingTrue();
            nonceRef.current += 1;
            const requestNonce = nonceRef.current;
            const { r, nonce } = await methodWithNonce({
              nonce: requestNonce,
            });
            if (shouldSetState() && nonceRef.current === nonce) {
              setResult(r);
            }
          }
        } catch (err) {
          if (shouldSetState() && undefinedResultIfError) {
            setResult(undefined);
          } else {
            throw err;
          }
        } finally {
          if (loadingDelay && watchLoading) {
            await timerUtils.wait(loadingDelay);
          }
          if (shouldSetState()) {
            setLoadingFalse();
          }
          if (pollingInterval) {
            await timerUtils.wait(pollingInterval);
            if (shouldSetState()) {
              void run({ triggerByDeps: true });
            } else {
              isDepsChangedOnBlur.current = true;
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
          if (shouldSetState()) {
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
    void runRef.current({ triggerByDeps: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (
      isFocused &&
      optionsRef.current.checkIsFocused &&
      isDepsChangedOnBlur.current
    ) {
      isDepsChangedOnBlur.current = false;
      void runRef.current();
    }
  }, [isFocused]);

  return { result, isLoading, run };
}

export const useAsyncCall = usePromiseResult;
export const useAsyncResult = usePromiseResult;
export const useAsyncData = usePromiseResult;
