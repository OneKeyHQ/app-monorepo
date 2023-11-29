import { type PropsWithChildren, useCallback, useState } from 'react';

import { AnimatePresence, Stack } from 'tamagui';

import { SplashView } from './SplashView';

type ISplash = PropsWithChildren<{
  onReady: () => Promise<boolean>;
}>;

export function Splash({ onReady, children }: ISplash) {
  const [showLoadingView, changeLoadingVisibleStatus] = useState(true);
  const handleReady = useCallback(async () => {
    const isReady = await onReady();
    changeLoadingVisibleStatus(!isReady);
  }, [onReady]);

  return (
    <Stack flex={1}>
      {children}
      <AnimatePresence>
        {showLoadingView && (
          <Stack
            key="splash-view"
            bg="$background"
            animation="medium"
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
            <SplashView onReady={handleReady} />
          </Stack>
        )}
      </AnimatePresence>
    </Stack>
  );
}
