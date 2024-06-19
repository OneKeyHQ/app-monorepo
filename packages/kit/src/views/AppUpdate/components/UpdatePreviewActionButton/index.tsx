import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageFooterProps } from '@onekeyhq/components';
import { Page, Toast, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
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
  const intl = useIntl();
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
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_update_failed,
                }),
              });
              void backgroundApiProxy.serviceAppUpdate.notifyFailed(e);
            });
          if (autoClose) {
            close();
          }
        }
      }
    },
    [appUpdateInfo.data, autoClose, intl],
  );

  const handleToInstall = useCallback(async () => {
    try {
      await installPackage(appUpdateInfo.data);
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

  const renderButtonText = useCallback(() => {
    if (isDownloading) {
      return intl.formatMessage(
        {
          id: ETranslations.update_progress_downloading,
        },
        {
          progress,
        },
      );
    }

    if (isReadyToInstall) {
      return intl.formatMessage({
        id: platformEnv.isNativeAndroid
          ? ETranslations.update_install_now
          : ETranslations.update_restart_to_update,
      });
    }
    return intl.formatMessage({
      id: ETranslations.update_update_now,
    });
  }, [intl, isDownloading, isReadyToInstall, progress]);
  return (
    <Page.Footer>
      <YStack>
        <Page.FooterActions
          confirmButtonProps={{
            disabled: isDownloading,
            loading: isDownloading,
          }}
          onConfirmText={renderButtonText()}
          onConfirm={isReadyToInstall ? handleToInstall : handleToUpdate}
        />
      </YStack>
    </Page.Footer>
  );
};
