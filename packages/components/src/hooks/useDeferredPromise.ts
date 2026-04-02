import { useMemo } from 'react';

enum EDeferStatus {
  pending = 'pending',
  resolved = 'resolved',
  rejected = 'rejected',
}
export type IDeferredPromise<DeferType> = {
  resolve: (value: DeferType) => void;
  reject: (value: unknown) => void;
  reset: () => void;
  promise: Promise<DeferType>;
  status: EDeferStatus;
};

export const buildDeferredPromise = <DeferType>() => {
  const deferred = {} as IDeferredPromise<DeferType>;

  const buildPromise = () => {
    const promise = new Promise<DeferType>((resolve, reject) => {
      deferred.status = EDeferStatus.pending;
      deferred.resolve = (value: DeferType) => {
        deferred.status = EDeferStatus.resolved;
        resolve(value);
      };
      deferred.reject = (reason: unknown) => {
        deferred.status = EDeferStatus.rejected;
        reject(reason);
      };
    });

    deferred.promise = promise;
  };

  buildPromise();

  deferred.reset = () => {
    if (deferred.status !== EDeferStatus.pending) {
      buildPromise();
    }
  };
  return deferred;
};

export function useDeferredPromise<DeferType>() {
  const defer = useMemo(() => buildDeferredPromise<DeferType>(), []);
  return defer;
}
