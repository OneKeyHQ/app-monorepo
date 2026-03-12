/* eslint-disable global-require */
import {
  type PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Splash } from '@onekeyhq/components';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

const SPLASH_SAFETY_TIMEOUT = 10_000;

export const useDisplaySplash =
  platformEnv.isDesktop || platformEnv.isNative
    ? () => {
        const [displaySplash, setDisplaySplash] = useState(false);
        const hasLaunchEventsExecutedRef = useRef(false);

        useLayoutEffect(() => {
          if (hasLaunchEventsExecutedRef.current) {
            return;
          }

          // Safety net: if the async logic below hangs or throws an
          // unhandled error, force the splash to show so the app is
          // never stuck on a blank native splash screen.
          const safetyTimer = setTimeout(() => {
            defaultLogger.app.appUpdate.log(
              `SplashProvider: safety timer fired after ${SPLASH_SAFETY_TIMEOUT}ms, forcing splash display`,
            );
            setDisplaySplash(true);
          }, SPLASH_SAFETY_TIMEOUT);

          const launchCallback = async () => {
            hasLaunchEventsExecutedRef.current = true;
            try {
              await backgroundApiProxy.servicePendingInstallTask.processPendingInstallTask();
              setDisplaySplash(true);
            } catch (error) {
              defaultLogger.app.appUpdate.log(
                `SplashProvider: launch callback failed: ${(error as Error)?.message}`,
              );
              setDisplaySplash(true);
            }
          };
          void launchCallback();

          return () => {
            clearTimeout(safetyTimer);
          };
        }, []);
        return displaySplash;
      }
    : () => {
        return true;
      };

export function SplashProvider({ children }: PropsWithChildren<unknown>) {
  const displaySplash = useDisplaySplash();

  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('SplashProvider render', `displaySplash=${displaySplash}`);
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

  return displaySplash ? <Splash>{children}</Splash> : null;
}
