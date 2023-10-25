import type { PropsWithChildren } from 'react';
import { Suspense } from 'react';

import { createSuspender } from '@onekeyhq/shared/src/modules3rdParty/use-suspender';

import useIsLowPerformanceDevice from '../hooks/useIsLowPerformanceDevice';
import { Spinner } from '../Spinner';
import { Stack } from '../Stack';

const Loading = () => (
  <Stack flex={1} alignContent="center" justifyContent="center">
    <Spinner size="small" />
  </Stack>
);

const useWaitNavigationAnimation = createSuspender(
  () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 0);
    }),
);

const PendingComponent = ({ children }: PropsWithChildren<unknown>) => {
  useWaitNavigationAnimation();
  return children;
};

function LoadingScreen({ children }: PropsWithChildren<unknown>) {
  return (
    <Suspense fallback={<Loading />}>
      <PendingComponent>{children}</PendingComponent>
    </Suspense>
  );
}

export function Screen({ children }: PropsWithChildren<unknown>) {
  const isLowPerformanceDevice = useIsLowPerformanceDevice();
  return (
    <Stack flex={1}>
      {isLowPerformanceDevice ? (
        <LoadingScreen>{children}</LoadingScreen>
      ) : (
        children
      )}
    </Stack>
  );
}
