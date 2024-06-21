import { useMemo } from 'react';

export type IDeferredPromise<DeferType> = {
  resolve: (value: DeferType) => void;
  reject: (value: unknown) => void;
  promise: Promise<DeferType>;
};

export function useDeferredPromise<DeferType>() {
  const defer = useMemo(() => {
    const deferred = {} as IDeferredPromise<DeferType>;

    const promise = new Promise<DeferType>((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });

    deferred.promise = promise;
    return deferred;
  }, []);

  return defer;
}
