import type { PropsWithChildren } from 'react';
import { Suspense, useRef } from 'react';

import { createSuspender } from '@onekeyhq/shared/src/modules3rdParty/use-suspender';

import { Spinner } from '../Spinner';
import { Stack } from '../Stack';

const Loading = () => (
  <Stack flex={1} alignContent="center" justifyContent="center">
    <Spinner size="small" />
  </Stack>
);

const waitNavigationAnimation = createSuspender(
  () =>
    new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 0);
    }),
);

const PendingComponent = ({ children }: PropsWithChildren<unknown>) => {
  const isLoaded = useRef(false);
  if (!isLoaded.current) {
    waitNavigationAnimation();
    isLoaded.current = true;
  }
  return children;
};

function LoadingScreen({ children }: PropsWithChildren<unknown>) {
  return (
    <Suspense fallback={<Loading />}>
      <PendingComponent>{children}</PendingComponent>
    </Suspense>
  );
}

export function BasicPage({
  children,
  skipLoading = false,
}: PropsWithChildren<unknown> & {
  skipLoading?: boolean;
}) {
  return (
    <Stack bg="$bgApp" flex={1}>
      {skipLoading ? children : <LoadingScreen>{children}</LoadingScreen>}
    </Stack>
  );
}
