import { useCallback, useMemo, useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { markFPTime } from '@onekeyhq/shared/src/modules3rdParty/metrics';

import { Stack } from '../../primitives';

import { SplashView } from './SplashView';

import type { LayoutChangeEvent } from 'react-native';

export type ISplashProps = PropsWithChildren;

export function Splash({ children }: ISplashProps) {
  const resolveSplash = useRef<() => void>();
  const handleExitComplete = useCallback(() => {
    markFPTime();
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height) {
      // close the splash after the react commit phase.
      setTimeout(() => {
        resolveSplash.current?.();
      });
    }
  }, []);

  const ready = useMemo(
    () =>
      new Promise<void>((resolve) => {
        resolveSplash.current = resolve;
      }),
    [],
  );

  return (
    <Stack flex={1} onLayout={handleLayout}>
      {children}
      <SplashView ready={ready} onExit={handleExitComplete} />
    </Stack>
  );
}
