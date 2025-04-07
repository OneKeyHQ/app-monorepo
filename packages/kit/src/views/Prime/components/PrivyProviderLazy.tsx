import { Suspense, lazy } from 'react';

const PrivyProvider = lazy(() =>
  import('./PrivyProvider').then((m) => ({ default: m.PrivyProvider })),
);

export function PrivyProviderLazy({ children }: { children: React.ReactNode }) {
  // const [devSettings] = useDevSettingsPersistAtom();
  // if (devSettings.enabled && devSettings.settings?.showPrimeTest) {
  //   return (
  //     <Suspense fallback={null}>
  //       <PrivyProvider>{children}</PrivyProvider>
  //     </Suspense>
  //   );
  // }
  // return children;

  return (
    <Suspense fallback={null}>
      <PrivyProvider>{children}</PrivyProvider>
    </Suspense>
  );
}
