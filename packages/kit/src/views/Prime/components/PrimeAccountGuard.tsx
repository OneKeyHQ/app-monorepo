import type { ComponentType, ReactNode } from 'react';

import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isPrimeUserBannedMockEnabled } from '@onekeyhq/shared/src/prime/primeUserBanned';

const OneKeyId = LazyLoadPage(() => import('../pages/OneKeyId'));

export function PrimeAccountGuard({ children }: { children: ReactNode }) {
  const [user] = usePrimePersistAtom();
  const [devSettings] = useDevSettingsPersistAtom();
  const isMock = isPrimeUserBannedMockEnabled(devSettings, platformEnv);
  return user.isOneKeyIdBanned || isMock ? <OneKeyId /> : children;
}

export function withPrimeAccountGuard<P extends object>(
  Component: ComponentType<P>,
) {
  return function GuardedPrimePage(props: P) {
    return (
      <PrimeAccountGuard>
        <Component {...props} />
      </PrimeAccountGuard>
    );
  };
}
