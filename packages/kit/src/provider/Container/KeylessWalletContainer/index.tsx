import { Suspense, lazy } from 'react';

const KeylessWalletContainer = lazy(() =>
  import('./KeylessWalletContainer').then((m) => ({
    default: m.KeylessWalletContainer,
  })),
);

export function KeylessWalletContainerLazy() {
  return (
    <Suspense fallback={null}>
      <KeylessWalletContainer />
    </Suspense>
  );
}
