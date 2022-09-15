import { useEffect, useRef, useState } from 'react';

import { wait } from '../utils/helper';

import { useIsMounted } from './useIsMounted';

// TODO useSWR instead
export function usePromiseResult<T>(
  method: (...args: any[]) => Promise<T>,
  deps: any[] = [],
  { loadingDelay = 0 }: { loadingDelay?: number } = {},
) {
  const isMountedRef = useIsMounted();
  const [result, setResult] = useState<T | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const methodRef = useRef<typeof method>();
  methodRef.current = method;

  useEffect(() => {
    (async function () {
      try {
        if (isMountedRef.current) setIsLoading(true);
        const r = await methodRef?.current?.();
        if (isMountedRef.current) setResult(r);
      } finally {
        await wait(loadingDelay);
        if (isMountedRef.current) setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { result, isLoading };
}
