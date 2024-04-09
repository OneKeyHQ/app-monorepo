import { useCallback, useEffect, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAppUpdateStatus, isNeedUpdate } from '@onekeyhq/shared/src/appUpdate';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';

export const useAppUpdateInfo = () => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  useEffect(() => {
    void backgroundApiProxy.ServiceAppUpdate.fetchAppUpdateInfo();
  }, []);

  const navigation = useAppNavigation();

  const onUpdateAction = useCallback(() => {
    console.log('1111');
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
        navigation.pushFullModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.UpdatePreview,
        });
        break;
      case EAppUpdateStatus.ready:
        break;
      default:
        break;
    }
  }, [appUpdateInfo.status, navigation]);

  return useMemo(
    () =>
      isNeedUpdate(appUpdateInfo.version, appUpdateInfo.latestVersion)
        ? {
            data: appUpdateInfo,
            onUpdateAction,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [appUpdateInfo.version, appUpdateInfo.latestVersion, appUpdateInfo.status],
  );
};
