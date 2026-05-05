import { isArray, isEmpty, isFunction, isNil, isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IOneKeyError } from '../errors/types/errorTypes';

export const PROMISE_CONCURRENCY_LIMIT = platformEnv.isNative ? 8 : 10;

export const createDelayPromise = <T>(
  delay: number,
  value?: T,
): Promise<T | undefined> =>
  new Promise((resolve) => setTimeout(() => resolve(value), delay));

export const createAnyPromise = <T>(promises: Promise<T>[]): Promise<T> =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  Promise.all(
    promises.map((p) =>
      p.then(
        (val) => Promise.reject(val),
        (err) => Promise.resolve(err),
      ),
    ),
  ).then(
    (errors) => Promise.reject(errors),
    (val) => Promise.resolve(val),
  );

export function createTimeoutPromise<T>({
  asyncFunc,
  timeout,
  timeoutResult,
}: {
  asyncFunc: () => Promise<T>;
  timeout: number;
  timeoutResult: T;
}) {
  return new Promise<T>((resolve) => {
    let isResolved = false;
    const timer = setTimeout(() => {
      if (isResolved) {
        return;
      }
      isResolved = true;
      resolve(timeoutResult);
      // console.log('createTimeoutPromise timeout result >>>>> ', timeoutResult);
    }, timeout);

    const p = asyncFunc();
    void p.then((result) => {
      if (isResolved) {
        return;
      }
      isResolved = true;
      clearTimeout(timer);
      resolve(result);
      // console.log('createTimeoutPromise correct result >>>>> ', result);
    });
  });
}

export function waitAsync(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}

export async function waitForDataLoaded({
  data,
  wait = 600,
  logName,
  timeout = 0,
}: {
  data: (...args: any) => any;
  wait?: number;
  logName: string;
  timeout?: number;
}) {
  let timeoutReject = false;
  let timer: any = null;
  const getDataArrFunc = ([] as ((...args: any) => any)[]).concat(data);
  if (timeout) {
    timer = setTimeout(() => {
      timeoutReject = true;
    }, timeout);
  }
  let retry = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    retry += 1;
    let isAllLoaded = true;
    if (logName && __DEV__ && retry > 1) {
      console.log(`waitForDataLoaded: ${logName} (${retry})`);
    }
    await Promise.all(
      getDataArrFunc.map(async (getData) => {
        const d = await getData();
        if (d === false) {
          isAllLoaded = false;
          return;
        }

        if (isNil(d)) {
          isAllLoaded = false;
          return;
        }

        if (isEmpty(d)) {
          if (isPlainObject(d) || isArray(d)) {
            isAllLoaded = false;
          }
        }
      }),
    );

    if (isAllLoaded || timeoutReject) {
      break;
    }
    await waitAsync(wait);
  }
  clearTimeout(timer);
  if (timeoutReject) {
    throw new OneKeyLocalError(`waitForDataLoaded: ${logName ?? ''} timeout`);
  }
}

export function isPromiseObject(obj: any) {
  // if (obj === undefined) {
  //   return true;
  // }
  if (obj instanceof Promise) {
    return true;
  }
  if (Object?.prototype?.toString?.call?.(obj) === '[object Promise]') {
    return true;
  }
  if (isFunction((obj as { then?: () => any } | undefined)?.then)) {
    return true;
  }
  return false;
}

export async function promiseAllSettledEnhanced<T>(
  promisesOrFactories: Promise<T>[] | (() => Promise<T>)[],
  options?: { continueOnError?: boolean; concurrency?: number },
): Promise<(T | null)[]> {
  const { continueOnError, concurrency } = options ?? {};

  // When concurrency is set and items are task factories, execute in batches
  if (
    concurrency &&
    concurrency > 0 &&
    promisesOrFactories.length > 0 &&
    typeof promisesOrFactories[0] === 'function'
  ) {
    const factories = promisesOrFactories as (() => Promise<T>)[];
    const results: (T | null)[] = [];
    for (let i = 0; i < factories.length; i += concurrency) {
      const batch = factories.slice(i, i + concurrency).map((fn) => fn());
      if (continueOnError) {
        const settled = await Promise.allSettled(batch);
        results.push(
          ...settled.map((r) => (r.status === 'fulfilled' ? r.value : null)),
        );
      } else {
        const settled = await Promise.all(batch);
        results.push(...settled);
      }
    }
    return results;
  }

  const promises = promisesOrFactories as Promise<T>[];
  if (!continueOnError) {
    return Promise.all(promises);
  }

  const results = await Promise.allSettled(promises);
  return results.map((result) =>
    result.status === 'fulfilled' ? result.value : null,
  );
}

export class PromiseTarget<T> {
  // IMPORTANT: Declare _resolveFn and _rejectFn BEFORE ready!
  // This fixes a class field initialization order issue where rspack/SWC
  // would initialize _resolveFn to undefined AFTER the Promise executor
  // had already set it, causing the Promise to never resolve.
  _resolveFn: ((value: T) => void) | undefined;

  _rejectFn: ((error: Error | IOneKeyError) => void) | undefined;

  ready = new Promise<T>((resolve, reject) => {
    this._resolveFn = resolve;
    this._rejectFn = reject;
  });

  resolveTarget(value: T, delay = 0) {
    setTimeout(() => {
      this._resolveFn?.(value);
    }, delay);
  }

  rejectTarget(error: Error | IOneKeyError) {
    setTimeout(() => {
      this._rejectFn?.(error);
    }, 0);
  }
}
export function createPromiseTarget<T>() {
  const p = new PromiseTarget<T>();
  return p;
}

// p-timeout
// p-retry
// p-limit
// p-queue
// p-cancelable
// p-defer
// p-wait-for

// https://www.npmjs.com/package/bluebird
