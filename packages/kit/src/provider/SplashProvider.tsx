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

function logSplashProvider(message: string) {
  if (
    platformEnv.isNativeMainThread &&
    platformEnv.enableNativeBackgroundThread
  ) {
    defaultLogger.app.appUpdate.log(`[SplashProvider] ${message}`);
  }
}

export const useCanDismissSplash =
  platformEnv.isDesktop || platformEnv.isNative
    ? () => {
        const [canDismissSplash, setCanDismissSplash] = useState(false);
        const hasLaunchCallbackStartedRef = useRef(false);

        useEffect(() => {
          if (hasLaunchCallbackStartedRef.current) {
            return;
          }
          hasLaunchCallbackStartedRef.current = true;
          logSplashProvider('effect started');

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
        }, []);

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
