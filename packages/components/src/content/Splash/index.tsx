import { useCallback, useMemo, useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { type LayoutChangeEvent } from 'react-native';

import { Stack } from '../../primitives';

import { SplashView } from './SplashView';

export type ISplashProps = PropsWithChildren;

const noop = () => {};
export function Splash({ children }: ISplashProps) {
  const resolveSplash = useRef<() => void>(noop);
  const handleExitComplete = useCallback(() => {}, []);

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
