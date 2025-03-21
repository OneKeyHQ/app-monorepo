import { Suspense, lazy } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const PrivyProvider = lazy(() =>
  import('./PrivyProvider').then((m) => ({ default: m.PrivyProvider })),
);

export function PrivyProviderLazy({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PrivyProvider>{children}</PrivyProvider>
    </Suspense>
  );
  return children;
}
