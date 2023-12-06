import { type PropsWithChildren, useCallback, useRef, useState } from 'react';

import { AnimatePresence, Stack } from 'tamagui';

import { SplashView } from './SplashView';

import type { LayoutChangeEvent } from 'react-native';

export type ISplashProps = PropsWithChildren<{
  onReady: () => Promise<boolean>;
}>;

export function Splash({ onReady, children }: ISplashProps) {
  const [showLoading, changeLoadingVisibility] = useState(true);
  const [showChildren, changeChildrenVisibility] = useState(false);
  const readyRef = useRef(false);
  const handleReady = useCallback(async () => {
    changeChildrenVisibility(true);
    readyRef.current = await onReady();
  }, [onReady]);

  const handleCheck = useCallback(() => {
    if (!readyRef.current) {
      setTimeout(() => {
        handleCheck();
      }, 10);
    }
    setTimeout(() => {
      changeLoadingVisibility(false);
    });
  }, []);

  const handleChildrenLayout = useCallback(
    (e: LayoutChangeEvent) => {
      console.log('handleChildrenLayout', e.nativeEvent.layout);
      const { height } = e.nativeEvent.layout;
      if (height) {
        handleCheck();
      }
    },
    [handleCheck],
  );

  return (
    <Stack flex={1}>
      {showChildren ? (
        <Stack flex={1} onLayout={handleChildrenLayout}>
          {children}
        </Stack>
      ) : null}
      <AnimatePresence>
        {showLoading && (
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
