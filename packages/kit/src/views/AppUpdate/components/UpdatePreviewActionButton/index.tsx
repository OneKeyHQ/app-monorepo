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
  downloadPackage,
  installPackage,
  useDownloadProgress,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = ({
  autoClose,
}: {
  autoClose: boolean;
}) => {
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
          void backgroundApiProxy.serviceAppUpdate.startDownloading();
          void downloadPackage(appUpdateInfo.data)
            .then(() => {
              void backgroundApiProxy.serviceAppUpdate.readyToInstall();
            })
            .catch((e: { message: string }) => {
              const { message } = e as { message: string };
              if (message) {
                Toast.error({ title: message });
              }
              void backgroundApiProxy.serviceAppUpdate.notifyFailed(e);
            });
          if (autoClose) {
            close();
          }
        }
      }
    },
    [appUpdateInfo.data, autoClose],
  );

  const handleToInstall = useCallback(async () => {
    try {
      if (platformEnv.isNativeAndroid) {
        await installPackage(appUpdateInfo.data);
      }
    } catch (error) {
      const { message } = error as { message: string };
      if (message) {
        Toast.error({ title: message });
      }
    }
  }, [appUpdateInfo.data]);

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
