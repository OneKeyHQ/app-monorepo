import { useEffect, useRef, useState } from 'react';

import { wait } from '../utils/helper';

import { useIsMounted } from './useIsMounted';

// TODO useSWR instead
export function usePromiseResult<T>(
  method: (...args: any[]) => Promise<T>,
  deps: any[] = [],
  {
    loadingDelay = 0,
    checkIsMounted,
  }: { loadingDelay?: number; checkIsMounted?: boolean } = {},
) {
  const [result, setResult] = useState<T | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const methodRef = useRef<typeof method>();
  const isMountedRef = useIsMounted();
  methodRef.current = method;

  useEffect(() => {
    (async function () {
      const shouldSetState = () =>
        (checkIsMounted && isMountedRef.current) || !checkIsMounted;
      try {
        if (shouldSetState()) {
          setIsLoading(true);
          const r = await methodRef?.current?.();
          if (shouldSetState()) setResult(r);
        }
      } finally {
        await wait(loadingDelay);
        if (shouldSetState()) setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { result, isLoading };
}
