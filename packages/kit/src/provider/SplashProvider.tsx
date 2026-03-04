/* eslint-disable global-require */
import {
  type PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { Splash } from '@onekeyhq/components';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
  getUpdateFileType,
  isFirstLaunchAfterUpdated,
} from '@onekeyhq/shared/src/appUpdate';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
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
              const appInfo =
                await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();

              if (appInfo.updateStrategy === EUpdateStrategy.seamless) {
                if (isFirstLaunchAfterUpdated(appInfo)) {
                  setDisplaySplash(true);
                  await backgroundApiProxy.serviceAppUpdate.refreshUpdateStatus();
                  return;
                }
                if (appInfo.status === EAppUpdateStatus.ready) {
                  const fileType = getUpdateFileType(appInfo);
                  // Verify downloadedEvent exists before installing
                  if (!appInfo.downloadedEvent) {
                    defaultLogger.app.appUpdate.endInstallPackage(
                      false,
                      new Error('Missing downloadedEvent for seamless install'),
                    );
                    setDisplaySplash(true);
                    await backgroundApiProxy.serviceAppUpdate.reset();
                    return;
                  }
                  // NOTE: This check is intentionally NOT gated by the
                  // onekey_bundle_skip_gpg_verification dev setting.
                  // Seamless (silent) install requires valid signature + sha256
                  // even in dev mode — the skip-GPG flag only affects the
                  // interactive download-and-verify flow (DownloadVerify page).
                  if (
                    fileType === EUpdateFileType.jsBundle &&
                    (!appInfo.downloadedEvent.signature ||
                      !appInfo.downloadedEvent.sha256)
                  ) {
                    defaultLogger.app.appUpdate.endInstallPackage(
                      false,
                      new Error(
                        'Missing signature or sha256 for seamless install',
                      ),
                    );
                    setDisplaySplash(true);
                    await backgroundApiProxy.serviceAppUpdate.reset();
                    return;
                  }
                  try {
                    defaultLogger.app.appUpdate.startInstallPackage({
                      fileType,
                      data: appInfo,
                    });
                    if (fileType === EUpdateFileType.jsBundle) {
                      await BundleUpdate.installBundle(appInfo.downloadedEvent);
                    } else {
                      await AppUpdate.installPackage(appInfo);
                    }
                    defaultLogger.app.appUpdate.endInstallPackage(true);
                  } catch (e) {
                    setDisplaySplash(true);
                    defaultLogger.app.appUpdate.endInstallPackage(
                      false,
                      e as Error,
                    );
                    await backgroundApiProxy.serviceAppUpdate.reset();
                  }
                } else {
                  setDisplaySplash(true);
                }
              } else {
                setDisplaySplash(true);
              }
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
