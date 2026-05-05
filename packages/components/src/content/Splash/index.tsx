import { useCallback } from 'react';
import type { PropsWithChildren } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives/Stack';

import { SplashView } from './SplashView';

export type ISplashProps = PropsWithChildren<{
  canDismissSplash?: boolean;
}>;

const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

function logSplash(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    const elapsed = Date.now() - jsEntryStart;
    defaultLogger.app.appUpdate.log(`[Splash] ${message} (+${elapsed}ms)`);
  }
}

export function Splash({
  children,
  canDismissSplash: externalCanDismissSplash = true,
}: ISplashProps) {
  logSplash(`render externalCanDismissSplash=${externalCanDismissSplash}`);
  const handleExitComplete = useCallback(() => {
    const now = Date.now();
    const totalFromEntry = now - jsEntryStart;
    logSplash(
      `exit complete — splash hidden at +${totalFromEntry}ms from JS entry`,
    );
    globalThis.$$onekeyUIVisibleAt = now;
    if (typeof globalThis.nativePerformanceNow === 'function') {
      globalThis.$$onekeyUIVisibleFromPerformanceNow =
        globalThis.nativePerformanceNow();
    }
    // Print startup timing summary
    const jsReadyAt: number | undefined = (globalThis as any).$$onekeyJsReadyAt;
    defaultLogger.app.appUpdate.log(
      [
        `[StartupSummary] Total JS entry → UI visible: ${totalFromEntry}ms`,
        jsReadyAt ? `  jsReady: +${jsReadyAt - jsEntryStart}ms` : undefined,
        `  UI visible: +${totalFromEntry}ms`,
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }, []);

  return (
    <Stack flex={1}>
      {children}
      <SplashView
        canDismissSplash={externalCanDismissSplash}
        onExit={handleExitComplete}
      />
    </Stack>
  );
}
