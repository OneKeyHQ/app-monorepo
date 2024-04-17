import { useCallback } from 'react';

import RNFS from 'react-native-fs';

import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import { downloadAPK } from '@onekeyhq/shared/src/modules3rdParty/downloadModule';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const handlePress: () => void = useCallback(async () => {
    if (appUpdateInfo.data) {
      if (appUpdateInfo.data.storeUrl) {
        openUrlExternal(appUpdateInfo.data.storeUrl);
      } else if (appUpdateInfo.data.downloadUrl) {
        if (platformEnv.isDesktop) {
          void backgroundApiProxy.serviceAppUpdate.startDownloading();
          window.desktopApi?.on?.('update/checking', () => {
            console.log('update/checking');
          });
          window.desktopApi?.on?.('update/available', async ({ version }) => {
            console.log('update/available, version: ', version);
            window.desktopApi.downloadUpdate();
            await backgroundApiProxy.serviceAppUpdate.startDownloading();
          });
          window.desktopApi.checkForUpdates();
        } else if (platformEnv.isNativeAndroid) {
          await backgroundApiProxy.serviceAppUpdate.startDownloading();
          await downloadAPK(
            appUpdateInfo.data.downloadUrl,
            appUpdateInfo.data.latestVersion,
          );
          await backgroundApiProxy.serviceAppUpdate.readyToInstall();
        }
      }
    }
  }, [appUpdateInfo.data]);
  return appUpdateInfo.data?.status === EAppUpdateStatus.downloading ? null : (
    <Page.Footer onConfirmText="Update Now" onConfirm={handlePress} />
  );
};
