import { Suspense, lazy } from 'react';

import { usePrimeAvailable } from '../../../views/Prime/hooks/usePrimeAvailable';

const PrimeLoginContainer = lazy(() =>
  import('./PrimeLoginContainer').then((m) => ({
    default: m.PrimeLoginContainer,
  })),
);

export function PrimeLoginContainerLazy() {
  const { isPrimeAvailable } = usePrimeAvailable();
  if (isPrimeAvailable) {
    return (
      <Suspense fallback={null}>
        <PrimeLoginContainer />
      </Suspense>
    );
  }
  return null;
}
