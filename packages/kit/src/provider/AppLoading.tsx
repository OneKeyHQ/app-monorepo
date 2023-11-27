/* eslint-disable global-require */
import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { Splash, Stack } from '@onekeyhq/components';
// import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

const waitDataReady = () =>
  new Promise<boolean>((resolve) => {
    setTimeout(() => {
      // TODO：Hide the Splash View only when data is ready.
      resolve(true);
    }, 100);
  });

function AppLoading({ children }: PropsWithChildren<unknown>) {
  const handleReady = useCallback(() => waitDataReady(), []);
  return (
    <Stack flex={1}>
      <Splash onReady={handleReady}>{children}</Splash>
    </Stack>
  );
}

export default AppLoading;
