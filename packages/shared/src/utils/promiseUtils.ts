import { isArray, isEmpty, isFunction, isNil, isPlainObject } from 'lodash';

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
    throw new Error(`waitForDataLoaded: ${logName ?? ''} timeout`);
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
