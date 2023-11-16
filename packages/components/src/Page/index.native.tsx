import type { PropsWithChildren } from 'react';
import { Suspense, useMemo } from 'react';

import { createSuspender } from '@onekeyhq/shared/src/modules3rdParty/use-suspender';

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

export function Page({
  children,
  skipLoading = false,
}: PropsWithChildren<unknown> & {
  skipLoading?: boolean;
}) {
  return useMemo(
    () => (
      <Stack flex={1} bg="$bgApp">
        {skipLoading ? children : <LoadingScreen>{children}</LoadingScreen>}
      </Stack>
    ),
    // Children are the content of page elements, Do not re-render by children.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
}
