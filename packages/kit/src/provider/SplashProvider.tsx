/* eslint-disable global-require */
import { type PropsWithChildren, useEffect, useRef, useState } from 'react';

import { Splash } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const SPLASH_SAFETY_TIMEOUT = 10_000;
const jsEntryStart: number =
  (globalThis as any).__ONEKEY_MAIN_ENTRY_START__ || Date.now();

function logSplashProvider(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    const elapsed = Date.now() - jsEntryStart;
    defaultLogger.app.appUpdate.log(
      `[SplashProvider] ${message} (+${elapsed}ms)`,
    );
  }
}

/** Check if jotai was hydrated from MMKV snapshot (not first install). */
function hasJotaiCacheFromMmkv(): boolean {
  // Set by index.ts when MMKV snapshot is pre-read
  return Boolean((globalThis as any).__ONEKEY_JOTAI_SNAPSHOT_USED__);
}

export const useCanDismissSplash =
  platformEnv.isDesktop || platformEnv.isNative
    ? () => {
        // When MMKV cache was used, skip processPendingInstallTask gate.
        // The cached atom states are valid; pending install tasks run in background.
        const hasCachedStates = hasJotaiCacheFromMmkv();

        const [canDismissSplash, setCanDismissSplash] = useState(
          hasCachedStates,
        );
        const hasLaunchCallbackStartedRef = useRef(false);

        useEffect(() => {
          if (hasLaunchCallbackStartedRef.current) {
            return;
          }
          hasLaunchCallbackStartedRef.current = true;
          logSplashProvider(
            `effect started, hasCachedStates=${hasCachedStates}`,
          );

          const safetyTimer = setTimeout(() => {
            defaultLogger.app.appUpdate.log(
              `SplashProvider: safety timer fired after ${SPLASH_SAFETY_TIMEOUT}ms, forcing splash hide`,
            );
            logSplashProvider('safety timer fired');
            setCanDismissSplash(true);
          }, SPLASH_SAFETY_TIMEOUT);

          const handlePendingInstallTaskFinished = () => {
            logSplashProvider('pending install task finished event received');
            clearTimeout(safetyTimer);
            setCanDismissSplash(true);
          };

          appEventBus.on(
            EAppEventBusNames.PendingInstallTaskProcessFinished,
            handlePendingInstallTaskFinished,
          );

          // Always run processPendingInstallTask (for OTA updates),
          // but don't block splash when we have cached states.
          const launchCallback = async () => {
            try {
              logSplashProvider('launch callback start');
              await backgroundApiProxy.servicePendingInstallTask.processPendingInstallTask();
              logSplashProvider('launch callback resolved');
            } catch (error) {
              defaultLogger.app.appUpdate.log(
                `SplashProvider: launch callback failed: ${(error as Error)?.message}`,
              );
              logSplashProvider(
                `launch callback failed: ${(error as Error)?.message ?? 'unknown'}`,
              );
              handlePendingInstallTaskFinished();
            }
          };
          void launchCallback();

          return () => {
            logSplashProvider('effect cleanup');
            clearTimeout(safetyTimer);
            appEventBus.off(
              EAppEventBusNames.PendingInstallTaskProcessFinished,
              handlePendingInstallTaskFinished,
            );
          };
        }, [hasCachedStates]);

        useEffect(() => {
          logSplashProvider(`canDismissSplash=${canDismissSplash}`);
        }, [canDismissSplash]);

        return canDismissSplash;
      }
    : () => true;

export function SplashProvider({ children }: PropsWithChildren<unknown>) {
  const canDismissSplash = useCanDismissSplash();
  logSplashProvider(`render canDismissSplash=${canDismissSplash}`);

  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('SplashProvider render');
  }

  // Web platform: skip splash screen entirely, render children directly
  useEffect(() => {
    if (platformEnv.isWeb) {
      globalThis.$$onekeyUIVisibleAt = Date.now();
    }
  }, []);

  if (platformEnv.isWeb) {
    return <>{children}</>;
  }

  return <Splash canDismissSplash={canDismissSplash}>{children}</Splash>;
}
