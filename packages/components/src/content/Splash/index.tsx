import { useCallback, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { type LayoutChangeEvent } from 'react-native';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives/Stack';

import { SplashView } from './SplashView';

export type ISplashProps = PropsWithChildren<{
  canDismissSplash?: boolean;
}>;

function logSplash(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    defaultLogger.app.appUpdate.log(`[Splash] ${message}`);
  }
}

export function Splash({
  children,
  canDismissSplash: externalCanDismissSplash = true,
}: ISplashProps) {
  const [isContentReady, setIsContentReady] = useState(false);
  const canDismissSplash = isContentReady ? externalCanDismissSplash : false;
  logSplash(
    `render isContentReady=${isContentReady}, externalCanDismissSplash=${externalCanDismissSplash}, canDismissSplash=${canDismissSplash}`,
  );
  const handleExitComplete = useCallback(() => {
    logSplash('exit complete');
    globalThis.$$onekeyUIVisibleAt = Date.now();
    if (typeof globalThis.nativePerformanceNow === 'function') {
      globalThis.$$onekeyUIVisibleFromPerformanceNow =
        globalThis.nativePerformanceNow();
    }
  }, []);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    logSplash(`onLayout height=${height}`);
    if (height) {
      // close the splash after the react commit phase.
      setTimeout(() => {
        logSplash('content marked ready');
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
