import { Suspense, lazy } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const PrimeLoginContainer = lazy(() =>
  import('./PrimeLoginContainer').then((m) => ({
    default: m.PrimeLoginContainer,
  })),
);

export function PrimeLoginContainerLazy() {
  const [devSettings] = useDevSettingsPersistAtom();
  if (devSettings.enabled && devSettings.settings?.showPrimeTest) {
    return (
      <Suspense fallback={null}>
        <PrimeLoginContainer />
      </Suspense>
    );
  }
  return null;
}
