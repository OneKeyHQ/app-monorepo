import { useCallback } from 'react';

import { Page } from '@onekeyhq/components';
import { useAppUpdateInfo } from '@onekeyhq/kit/src/components/UpdateReminder/hooks';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import type { IUpdatePreviewActionButton } from './type';

export const UpdatePreviewActionButton: IUpdatePreviewActionButton = () => {
  const appUpdateInfo = useAppUpdateInfo();
  const handlePress = useCallback(() => {
    if (appUpdateInfo.data) {
      if (appUpdateInfo.data.storeUrl) {
        openUrlExternal(appUpdateInfo.data.storeUrl);
      } else if (appUpdateInfo.data.downloadUrl) {
        // download package in App
      }
    }
  }, [appUpdateInfo.data]);
  return <Page.Footer onConfirmText="Update Now" onConfirm={handlePress} />;
};
