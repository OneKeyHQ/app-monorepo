import { useEffect, useRef, useState } from 'react';

import { wait } from '../utils/helper';

// TODO useSWR instead
export function usePromiseResult<T>(
  method: (...args: any[]) => Promise<T>,
  deps: any[] = [],
  { loadingDelay = 0 }: { loadingDelay?: number } = {},
) {
  const [result, setResult] = useState<T | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const methodRef = useRef<typeof method>();
  methodRef.current = method;

  useEffect(() => {
    (async function () {
      try {
        setIsLoading(true);
        const r = await methodRef?.current?.();
        setResult(r);
      } finally {
        await wait(loadingDelay);
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { result, isLoading };
}
