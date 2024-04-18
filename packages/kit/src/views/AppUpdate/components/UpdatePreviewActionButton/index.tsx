import { useCallback } from 'react';

import type { IPageFooterProps } from '@onekeyhq/components';
import {
  Page,
  Progress,
  SizableText,
  Toast,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import {
  downloadAPK,
  installAPK,
  useDownloadProgress,
} from '@onekeyhq/shared/src/modules3rdParty/download-module';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const downloadSuccess = useCallback(() => {}, []);
  const downloadFailed = useCallback(() => {}, []);
  const progress = useDownloadProgress(downloadSuccess, downloadFailed);
  const handleToUpdate: IPageFooterProps['onConfirm'] = useCallback(
    (close: () => void) => {
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
            void backgroundApiProxy.serviceAppUpdate.startDownloading();
            void downloadAPK(
              appUpdateInfo.data.downloadUrl,
              appUpdateInfo.data.latestVersion,
            )
              .then(() => {
                void backgroundApiProxy.serviceAppUpdate.readyToInstall();
              })
              .catch((e) => {
                void backgroundApiProxy.serviceAppUpdate.notifyFailed(e);
              });
          }
          close();
        }
      }
    },
    [appUpdateInfo.data],
  );

  const handleToInstall = useCallback(async () => {
    try {
      if (platformEnv.isNativeAndroid) {
        await installAPK(appUpdateInfo.data.latestVersion);
      }
    } catch (error) {
      Toast.error({ title: (error as { message: string }).message });
    }
  }, [appUpdateInfo.data.latestVersion]);

  const isDownloading =
    EAppUpdateStatus.downloading === appUpdateInfo.data?.status;

  const isReadyToInstall =
    EAppUpdateStatus.ready === appUpdateInfo.data?.status;
  return (
    <Page.Footer>
      <YStack>
        {isDownloading ? (
          <YStack mx="$10" alignItems="center">
            {progress > 0 && progress < 100 ? (
              <SizableText>{`${progress}%`}</SizableText>
            ) : null}
            <Progress value={progress} />
          </YStack>
        ) : null}
        <Page.FooterActions
          confirmButtonProps={{ disabled: isDownloading }}
          onConfirmText={isReadyToInstall ? 'Restart to Update' : 'Update Now'}
          onConfirm={isReadyToInstall ? handleToInstall : handleToUpdate}
        />
      </YStack>
    </Page.Footer>
  );
};
