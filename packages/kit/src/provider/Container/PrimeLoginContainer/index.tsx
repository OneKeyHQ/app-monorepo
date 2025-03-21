import { Suspense, lazy } from 'react';

const PrimeLoginContainer = lazy(() =>
  import('./PrimeLoginContainer').then((m) => ({
    default: m.PrimeLoginContainer,
  })),
);

export function PrimeLoginContainerLazy() {
  return (
    <Suspense fallback={null}>
      <PrimeLoginContainer />
    </Suspense>
  );
}
