import { useMemo } from 'react';

export type IDeferredPromise<DeferType> = {
  resolve: (value: DeferType) => void;
  reject: (value: unknown) => void;
  reset: () => void;
  promise: Promise<DeferType>;
};

export function useDeferredPromise<DeferType>() {
  const defer = useMemo(() => {
    const deferred = {} as IDeferredPromise<DeferType>;

    const buildPromise = () => {
      const promise = new Promise<DeferType>((resolve, reject) => {
        deferred.resolve = resolve;
        deferred.reject = reject;
      });

      deferred.promise = promise;
    };

    buildPromise();

    deferred.reset = () => {
      buildPromise();
    };
    return deferred;
  }, []);

  return defer;
}
