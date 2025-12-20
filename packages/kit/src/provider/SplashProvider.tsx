/* eslint-disable global-require */
import {
  type PropsWithChildren,
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const useDisplaySplash =
  platformEnv.isDesktop || platformEnv.isNative
    ? () => {
        const [displaySplash, setDisplaySplash] = useState(false);
        const hasLaunchEventsExecutedRef = useRef(false);

        useLayoutEffect(() => {
          if (hasLaunchEventsExecutedRef.current) {
            return;
          }
          const launchCallback = async () => {
            hasLaunchEventsExecutedRef.current = true;
            const appInfo =
              await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();

            if (appInfo.updateStrategy === EUpdateStrategy.seamless) {
              if (isFirstLaunchAfterUpdated(appInfo)) {
                await backgroundApiProxy.serviceAppUpdate.refreshUpdateStatus();
                setDisplaySplash(true);
                return;
              }
              if (appInfo.status === EAppUpdateStatus.ready) {
                const fileType = getUpdateFileType(appInfo);
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
          };
          void launchCallback();
        }, []);
        return displaySplash;
      }
    : () => {
        return true;
      };

export function SplashProvider({ children }: PropsWithChildren<unknown>) {
  const displaySplash = useDisplaySplash();
  return displaySplash ? <Splash>{children}</Splash> : null;
}
