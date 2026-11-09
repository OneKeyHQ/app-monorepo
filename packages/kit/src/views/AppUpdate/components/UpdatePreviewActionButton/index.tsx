import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageFooterProps } from '@onekeyhq/components';
import { Page, YStack } from '@onekeyhq/components';
import {
  useAppUpdateInfo,
  useDownloadPackage,
} from '@onekeyhq/kit/src/components/AppUpdate';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  getUpdateFileType,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { showIntercom } from '@onekeyhq/shared/src/modules3rdParty/intercom';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { AppUpdateTestIDs } from '../../testIDs';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = ({
  isForceUpdate,
  onContactSupport,
}: {
  isForceUpdate?: boolean;
  onContactSupport?: () => void;
}) => {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo();

  const navigation = useAppNavigation();

  const { downloadPackage } = useDownloadPackage();

  const updateFileType = getUpdateFileType({
    latestVersion: appUpdateInfo.data?.latestVersion,
    jsBundleVersion: appUpdateInfo.data?.jsBundleVersion,
  });

  const shouldOpenStore =
    updateFileType === EUpdateFileType.appShell &&
    !!appUpdateInfo.data?.storeUrl?.startsWith('https://');

  const handleToUpdate: IPageFooterProps['onConfirm'] = useCallback(() => {
    if (appUpdateInfo.data) {
      defaultLogger.app.appUpdate.changelogUpdateClicked({
        action: shouldOpenStore ? 'store' : 'download',
      });
      if (
        shouldOpenStore &&
        appUpdateInfo.data.storeUrl?.startsWith('https://')
      ) {
        // Server-driven store URL must reach the store app via the system
        // browser; in-app browsers never trigger universal links.
        openUrlExternal(appUpdateInfo.data.storeUrl, {
          useSystemBrowser: true,
        });
      } else if (
        appUpdateInfo.data.downloadUrl ||
        appUpdateInfo.data.jsBundle?.downloadUrl
      ) {
        if (appUpdateInfo.data.status === EAppUpdateStatus.notify) {
          void downloadPackage();
        }
        navigation.push(EAppUpdateRoutes.DownloadVerify, {
          isForceUpdate,
        });
      }
    }
  }, [
    appUpdateInfo.data,
    downloadPackage,
    isForceUpdate,
    navigation,
    shouldOpenStore,
  ]);
  const handleContactSupport = useCallback(() => {
    if (onContactSupport) {
      onContactSupport();
      return;
    }
    void showIntercom();
  }, [onContactSupport]);

  return (
    <Page.Footer>
      <YStack>
        <Page.FooterActions
          stacked={isForceUpdate}
          onCancelText={
            isForceUpdate
              ? intl.formatMessage({
                  id: ETranslations.swap_review_tx_failed_2,
                })
              : undefined
          }
          onCancel={
            isForceUpdate
              ? (_close) => {
                  handleContactSupport();
                }
              : undefined
          }
          cancelButtonProps={
            isForceUpdate
              ? {
                  testID: AppUpdateTestIDs.contactUsBtn,
                }
              : undefined
          }
          onConfirmText={intl.formatMessage({
            id: shouldOpenStore
              ? ETranslations.update_update_now
              : ETranslations.update_download_and_verify_text,
          })}
          onConfirm={handleToUpdate}
        />
      </YStack>
    </Page.Footer>
  );
};
