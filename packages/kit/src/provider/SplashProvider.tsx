/* eslint-disable global-require */
import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { Splash } from '@onekeyhq/components';
// import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

const waitDataReady = () =>
  new Promise<boolean>((resolve) => {
    setTimeout(() => {
      // TODO：Hide the Splash View only when data is ready.
      resolve(true);
    }, 0);
  });

export function SplashProvider({ children }: PropsWithChildren<unknown>) {
  const handleReady = useCallback(() => waitDataReady(), []);
  return <Splash onReady={handleReady}>{children}</Splash>;
}
