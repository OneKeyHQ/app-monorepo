import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';

import { AnimatePresence } from 'tamagui';

import { View } from '../../optimization';
import { Spinner, Stack } from '../../primitives';

function Loading() {
  return (
    <Stack flex={1} alignContent="center" justifyContent="center">
      <Spinner size="small" />
    </Stack>
  );
}

function LoadingScreen({ children }: PropsWithChildren<unknown>) {
  const [showLoading, changeLoadingVisibleStatus] = useState(true);
  const [showChildren, changeChildrenVisibleStatus] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      changeChildrenVisibleStatus(true);
      setTimeout(() => {
        changeLoadingVisibleStatus(false);
      }, 0);
    }, 0);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {showChildren ? children : null}
      <AnimatePresence>
        {showLoading && (
          <Stack
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            opacity={1}
            flex={1}
            exitStyle={{
              opacity: 0,
            }}
          >
            <Loading />
          </Stack>
        )}
      </AnimatePresence>
    </View>
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
