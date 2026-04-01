import { useCallback, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { type LayoutChangeEvent } from 'react-native';

import { Stack } from '../../primitives/Stack';

import { SplashView } from './SplashView';

export type ISplashProps = PropsWithChildren<{
  canDismissSplash?: boolean;
}>;

export function Splash({
  children,
  canDismissSplash: externalCanDismissSplash = true,
}: ISplashProps) {
  const [isContentReady, setIsContentReady] = useState(false);
  const canDismissSplash = isContentReady ? externalCanDismissSplash : false;
  const handleExitComplete = useCallback(() => {
    globalThis.$$onekeyUIVisibleAt = Date.now();
    if (typeof globalThis.nativePerformanceNow === 'function') {
      globalThis.$$onekeyUIVisibleFromPerformanceNow =
        globalThis.nativePerformanceNow();
    }
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height) {
      // close the splash after the react commit phase.
      setTimeout(() => {
        setIsContentReady(true);
      });
    }
  }, []);

  return (
    <Stack flex={1} onLayout={handleLayout}>
      {children}
      <SplashView
        canDismissSplash={canDismissSplash}
        onExit={handleExitComplete}
      />
    </Stack>
  );
}
