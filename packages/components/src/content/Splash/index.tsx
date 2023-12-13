import { type PropsWithChildren, useCallback, useRef, useState } from 'react';

import { AnimatePresence, Stack } from 'tamagui';

import { ChildrenContent } from './ChildrenContent';
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
    } else {
      setTimeout(() => {
        changeLoadingVisibility(false);
      });
    }
  }, []);

  const handleChildrenLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      if (height) {
        handleCheck();
      }
    },
    [handleCheck],
  );

  return (
    <Stack flex={1}>
      <ChildrenContent onLayout={handleChildrenLayout} visible={showChildren}>
        {children}
      </ChildrenContent>
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
