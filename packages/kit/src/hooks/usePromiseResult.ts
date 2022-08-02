import { useEffect, useRef, useState } from 'react';

export function usePromiseResult<T>(method: (...args: any[]) => Promise<T>) {
  const [result, setResult] = useState<T | undefined>();
  const methodRef = useRef<typeof method>();
  methodRef.current = method;

  useEffect(() => {
    (async function () {
      const r = await methodRef?.current?.();
      setResult(r);
    })();
  }, []);
  return result;
}
