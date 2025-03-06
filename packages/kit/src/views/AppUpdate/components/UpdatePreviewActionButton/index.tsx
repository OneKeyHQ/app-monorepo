import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageFooterProps } from '@onekeyhq/components';
import { Page, YStack } from '@onekeyhq/components';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { downloadPackage } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { EAppUpdateRoutes } from '@onekeyhq/shared/src/routes/appUpdate';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
  const intl = useIntl();
  const appUpdateInfo = useAppUpdateInfo();

  const navigation = useAppNavigation();

  const handleToUpdate: IPageFooterProps['onConfirm'] = useCallback(() => {
    if (appUpdateInfo.data) {
      if (appUpdateInfo.data.storeUrl) {
        openUrlExternal(appUpdateInfo.data.storeUrl);
      } else if (appUpdateInfo.data.downloadUrl) {
        void downloadPackage(appUpdateInfo.data);
        navigation.push(EAppUpdateRoutes.DownloadVerify);
      }
    }
  }, [appUpdateInfo.data, navigation]);
  return (
    <Page.Footer>
      <YStack>
        <Page.FooterActions
          onConfirmText={intl.formatMessage({
            id: appUpdateInfo.data.storeUrl
              ? ETranslations.update_update_now
              : ETranslations.update_download_and_verify_text,
          })}
          onConfirm={handleToUpdate}
        />
      </YStack>
    </Page.Footer>
  );
};
