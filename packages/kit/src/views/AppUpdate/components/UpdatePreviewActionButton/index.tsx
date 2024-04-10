import { useCallback } from 'react';

import { NativeModules } from 'react-native';

import type { IPageFooterProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs/index.native';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const handlePress: IPageFooterProps['onConfirm'] = useCallback(
    async (close: () => void) => {
      if (appUpdateInfo.data) {
        if (appUpdateInfo.data.storeUrl) {
          openUrlExternal(appUpdateInfo.data.storeUrl);
        } else if (appUpdateInfo.data.downloadUrl) {
          if (platformEnv.isDesktop) {
            void backgroundApiProxy.ServiceAppUpdate.startDownloading();
            window.desktopApi?.on?.('update/checking', () => {
              console.log('update/checking');
            });
            window.desktopApi?.on?.('update/available', async ({ version }) => {
              console.log('update/available, version: ', version);
              window.desktopApi.downloadUpdate();
            });
            window.desktopApi.checkForUpdates();
            await backgroundApiProxy.ServiceAppUpdate.startDownloading();
          } else if (platformEnv.isNativeAndroid) {
            await RNFS.mkdir(`file://${RNFS.DocumentDirectoryPath}/apk`);
            await backgroundApiProxy.ServiceAppUpdate.startDownloading();
            await RNFS.downloadFile({
              fromUrl: appUpdateInfo.data.downloadUrl,
              toFile: `${RNFS.DocumentDirectoryPath}/apk/${
                appUpdateInfo.data.latestVersion || ''
              }.apk`,
              progress: console.log,
            });
            await backgroundApiProxy.ServiceAppUpdate.readToInstall();
          }
          close();
        }
      }
    },
    [appUpdateInfo.data],
  );
  return appUpdateInfo.data?.status === EAppUpdateStatus.downloading ? null : (
    <Page.Footer onConfirmText="Update Now" onConfirm={handlePress} />
  );
};
