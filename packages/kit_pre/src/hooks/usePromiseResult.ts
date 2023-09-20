import { useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/core';
import { debounce } from 'lodash';
// import useSWR from 'swr';

import { wait } from '../utils/helper';

import { useIsMounted } from './useIsMounted';

// import type { SWRConfiguration, SWRResponse } from 'swr';

// const [cache, mutate] = initCache({
//   get(key: string) {
//     debugger;
//   },
//   set(key: string, value: Data) {},
//   delete(key: string): void {},
//   keys() {},
// });
// const mockCache2 = initCache(new Map());

// type SWROptionsType = typeof useSWR extends (
//   key: infer Key,
//   fn?: infer Fn,
//   options?: infer Options,
// ) => SWRResponse<infer Data, infer Error>
//   ? Options
//   : SWRConfiguration;

// function useSWRPro<T extends (...args: any) => unknown>(
//   params: Parameters<T>[0],
//   fn: T,
//   options?: SWROptionsType,
// ) {
//   const { data, error, isLoading } = useSWR(params, fn, options);
//   console.log('useSWRFetch >>>>> ', isLoading, data, error);
//   type UnwrapPromise<T1> = T1 extends Promise<infer U> ? U : T1;
//   type DataType = UnwrapPromise<ReturnType<T>>;

//   return {
//     data: data as DataType,
//     error,
//     isLoading,
//   };
// }

type IRunnerConfig = { triggerByDeps?: boolean };

type IPromiseResultOptions<T> = {
  initResult?: T; // TODO rename to initData
  watchLoading?: boolean; // make isLoading work, which cause more once render
  loadingDelay?: number;
  checkIsMounted?: boolean;
  checkIsFocused?: boolean;
  debounced?: number;
};

/*
interface SWRResponse<Data = any, Error = any, Config = any> {
    data: BlockingData<Data, Config> extends true ? Data : Data | undefined;
    error: Error | undefined;
    mutate: KeyedMutator<Data>;
    isValidating: boolean;
    isLoading: BlockingData<Data, Config> extends true ? false : boolean;
}
*/
export function usePromiseResult<T>(
  method: (...args: any[]) => Promise<T>,
  deps: any[],
  options: { initResult: T } & IPromiseResultOptions<T>,
): { result: T; isLoading: boolean | undefined };

export function usePromiseResult<T>(
  method: (...args: any[]) => Promise<T>,
  deps: any[],
  options?: IPromiseResultOptions<T>,
): {
  result: T | undefined;
  isLoading: boolean | undefined;
  run: (config?: IRunnerConfig) => Promise<void>;
};

export function usePromiseResult<T>(
  method: (...args: any[]) => Promise<T>,
  deps: any[] = [],
  options: IPromiseResultOptions<T> = {},
): {
  result: T | undefined;
  isLoading: boolean | undefined;
  run: (config?: IRunnerConfig) => Promise<void>;
} {
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

  const run = useMemo(
    () => {
      const { watchLoading, loadingDelay, checkIsMounted, checkIsFocused } =
        optionsRef.current;

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

      const runner = async (config?: IRunnerConfig) => {
        if (config?.triggerByDeps && !isFocusedRef.current) {
          isDepsChangedOnBlur.current = true;
        }
        try {
          if (shouldSetState()) {
            setLoadingTrue();
            const r = await methodRef?.current?.();
            if (shouldSetState()) {
              setResult(r);
            }
          }
        } finally {
          if (loadingDelay && watchLoading) {
            await wait(loadingDelay);
          }
          if (shouldSetState()) {
            setLoadingFalse();
          }
        }
      };

      if (optionsRef.current.debounced) {
        const runnderDebounced = debounce(
          runner,
          optionsRef.current.debounced,
          {
            leading: false,
            trailing: true,
          },
        );
        return async (config?: IRunnerConfig) => {
          if (shouldSetState()) {
            setLoadingTrue();
          }
          await runnderDebounced(config);
        };
      }

      return runner;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    run({ triggerByDeps: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    if (
      isFocused &&
      optionsRef.current.checkIsFocused &&
      isDepsChangedOnBlur.current
    ) {
      isDepsChangedOnBlur.current = false;
      run();
    }
  }, [isFocused, run]);

  // TODO rename result to data
  return { result, isLoading, run };
}

export const useAsyncCall = usePromiseResult;
export const useAsyncResult = usePromiseResult;
export const useAsyncData = usePromiseResult;
