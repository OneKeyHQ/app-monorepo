import { useEffect, useRef, useState } from 'react';

// TODO useSWR instead
export function usePromiseResult<T>(
  method: (...args: any[]) => Promise<T>,
  deps: any[] = [],
) {
  const [result, setResult] = useState<T | undefined>();
  const methodRef = useRef<typeof method>();
  methodRef.current = method;

  useEffect(() => {
    (async function () {
      const r = await methodRef?.current?.();
      setResult(r);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { result };
}
