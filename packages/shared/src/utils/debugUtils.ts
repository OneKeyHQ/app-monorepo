import { useEffect, useRef } from 'react';

import stringUtils from './stringUtils';

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
      console.log(
        `ComponentRemountLog mounted: ${nameRef.current}`,
        stringUtils.safeStringify(payloadRef.current),
      );
    }
    return () => {
      if (process.env.NODE_ENV !== 'production') {
        console.log(
          `ComponentRemountLog unmounted: ${nameRef.current}`,
          stringUtils.safeStringify(payloadRef.current),
        );
      }
    };
  }, []);
}

function createSimpleDebugLog(logName: string, enable: boolean) {
  const log = (...args: any[]) => {
    if (!enable) {
      return;
    }
    console.log(`@@SimpleDebugLog:::${logName}`, ...args);
  };
  return log;
}

export default {
  useDebugComponentRemountLog,
  createSimpleDebugLog,
};
