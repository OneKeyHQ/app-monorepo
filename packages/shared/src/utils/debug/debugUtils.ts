import { useCallback, useEffect, useRef } from 'react';

import { isEmpty, isPlainObject } from 'lodash';

import stringUtils from '../stringUtils';

export function useDebugComponentRemountLog({
  name,
  payload,
}: {
  name: string;
  payload?: any;
}) {
  const nameRef = useRef(name);
  nameRef.current = name;

  const payloadRef = useRef(payload);
  payloadRef.current = payload;

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.groupCollapsed(
        `@@ComponentRemountLog mounted: ${nameRef.current}`,
      );
      console.log(stringUtils.safeStringify(payloadRef.current));
      console.log('href: ', globalThis?.location?.href);
      console.groupEnd();
    }
    return () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `@@ComponentRemountLog unmounted: ${nameRef.current}`,
          stringUtils.safeStringify(payloadRef.current),
        );
      }
    };
  }, []);
}

function getObjectDiff(
  a: { [key: string]: any },
  b: { [key: string]: any },
):
  | {
      [key: string]: any[];
    }
  | undefined {
  if (isPlainObject(a) && isPlainObject(b)) {
    return Object.keys(b).reduce((acc, key) => {
      if (a[key] !== b[key]) {
        acc[key] = [a[key], b[key]];
        const diff = getObjectDiff(a[key], b[key]);
        if (diff && !isEmpty(diff)) {
          acc[key].push(diff);
        }
      }
      return acc;
    }, {} as { [key: string]: any[] });
  }
  // 'not-both-plain-object': [a, b],
  return undefined;
}

export function useDebugHooksDepsChangedChecker(name: string) {
  const prevDepsRef = useRef<{ [key: string]: any }>({});

  const checkDeps = useCallback(
    (currentDeps: { [key: string]: any }) => {
      if (process.env.NODE_ENV !== 'production') {
        const prevDeps = prevDepsRef.current;

        const changedDeps = getObjectDiff(prevDeps, currentDeps);

        if (changedDeps && Object.keys(changedDeps).length) {
          console.log(`@@Deps_Changed:::${name}`, changedDeps);
        }

        prevDepsRef.current = currentDeps;
      }
    },
    [name],
  );

  return { checkDeps };
}

function createSimpleDebugLog(logName: string, enable: boolean) {
  const log = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      if (!enable) {
        return;
      }
      console.log(`@@SimpleDebugLog:::${logName}`, ...args);
    }
  };
  return log;
}

export default {
  useDebugComponentRemountLog,
  useDebugHooksDepsChangedChecker,
  getObjectDiff,
  createSimpleDebugLog,
};
