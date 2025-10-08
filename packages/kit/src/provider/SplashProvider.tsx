/* eslint-disable global-require */
import { type PropsWithChildren, useLayoutEffect, useRef } from 'react';

import { Splash } from '@onekeyhq/components';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
  getUpdateFileType,
} from '@onekeyhq/shared/src/appUpdate';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

export const useSeamlessInstall = (): void => {
  const hasLaunchEventsExecutedRef = useRef(false);

  useLayoutEffect(() => {
    if (hasLaunchEventsExecutedRef.current) {
      return;
    }
    const launchCallback = async () => {
      hasLaunchEventsExecutedRef.current = true;
      const appInfo = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      if (
        appInfo.status === EAppUpdateStatus.ready &&
        appInfo.updateStrategy === EUpdateStrategy.seamless
      ) {
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
          defaultLogger.app.appUpdate.endInstallPackage(false, e as Error);
        }
      }
    };
    void launchCallback();
  }, []);
};

export function SplashProvider({ children }: PropsWithChildren<unknown>) {
  useSeamlessInstall();
  return <Splash>{children}</Splash>;
}
