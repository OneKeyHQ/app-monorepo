import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const handlePress = useCallback(() => {
    if (appUpdateInfo.data) {
      if (appUpdateInfo.data.storeUrl) {
        openUrlExternal(appUpdateInfo.data.storeUrl);
      } else if (appUpdateInfo.data.downloadUrl) {
        if (platformEnv.isDesktop) {
          window.desktopApi?.on?.('update/checking', () => {
            console.log('update/checking');
          });
          window.desktopApi?.on?.('update/available', ({ version }) => {
            console.log('update/available, version: ', version);
            window.desktopApi.downloadUpdate();
          });
          window.desktopApi.checkForUpdates();
        } else if (platformEnv.isNativeAndroid) {
        }
      }
    }
  }, [appUpdateInfo.data]);
  return <Page.Footer onConfirmText="Update Now" onConfirm={handlePress} />;
};
