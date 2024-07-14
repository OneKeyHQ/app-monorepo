import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageFooterProps } from '@onekeyhq/components';
import { Page, Toast, YStack } from '@onekeyhq/components';
import {
  useAppUpdateInfo,
  useDownloadPackage,
} from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { EAppUpdateStatus } from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  installPackage,
  useDownloadProgress,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = ({
  autoClose,
}: {
  autoClose: boolean;
}) => {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo();
  const downloadPackage = useDownloadPackage();
  const downloadSuccess = useCallback(() => {}, []);
  const downloadFailed = useCallback(() => {}, []);
  const progress = useDownloadProgress(downloadSuccess, downloadFailed);
  const handleToUpdate: IPageFooterProps['onConfirm'] = useCallback(
    (close: () => void) => {
      if (appUpdateInfo.data) {
        if (appUpdateInfo.data.storeUrl) {
          openUrlExternal(appUpdateInfo.data.storeUrl);
        } else if (appUpdateInfo.data.downloadUrl) {
          void downloadPackage(appUpdateInfo.data);
          if (autoClose) {
            close();
          }
        }
      }
    },
    [appUpdateInfo.data, autoClose, downloadPackage],
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

  const isDisabledButton = [
    EAppUpdateStatus.downloading,
    EAppUpdateStatus.verifying,
  ].includes(appUpdateInfo.data?.status);

  const isReadyToInstall =
    EAppUpdateStatus.ready === appUpdateInfo.data?.status;

  const renderButtonText = useCallback(() => {
    switch (appUpdateInfo.data?.status) {
      case EAppUpdateStatus.downloading: {
        return intl.formatMessage(
          {
            id: ETranslations.update_progress_downloading,
          },
          {
            progress,
          },
        );
      }
      case EAppUpdateStatus.verifying: {
        return intl.formatMessage({
          id: ETranslations.update_verifying,
        });
      }
      default: {
        return intl.formatMessage({
          id: ETranslations.update_update_now,
        });
      }
    }
  }, [appUpdateInfo.data?.status, intl, progress]);
  return (
    <Page.Footer>
      <YStack>
        <Page.FooterActions
          confirmButtonProps={{
            disabled: isDisabledButton,
            loading: isDisabledButton,
          }}
          onConfirmText={renderButtonText()}
          onConfirm={isReadyToInstall ? handleToInstall : handleToUpdate}
        />
      </YStack>
    </Page.Footer>
  );
};
