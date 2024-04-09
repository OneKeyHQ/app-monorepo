import { useCallback, useEffect, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAppUpdateStatus, isNeedUpdate } from '@onekeyhq/shared/src/appUpdate';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useLocaleVariant } from '../../hooks/useLocaleVariant';

export const useAppUpdateInfo = () => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  useEffect(() => {
    void backgroundApiProxy.ServiceAppUpdate.fetchAppUpdateInfo();
  }, []);

  const navigation = useAppNavigation();

  const localVariant = useLocaleVariant();

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
        {
          const changeLog =
            appUpdateInfo.changeLog?.locale[localVariant] ||
            appUpdateInfo.changeLog?.locale['en-US'];
          navigation.pushFullModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.UpdatePreview,
            params: {
              version: appUpdateInfo.version,
              latestVersion: appUpdateInfo.latestVersion,
              changeLog,
            },
          });
        }
        break;
      case EAppUpdateStatus.ready:
        break;
      default:
        break;
    }
  }, [
    appUpdateInfo.changeLog?.locale,
    appUpdateInfo.latestVersion,
    appUpdateInfo.status,
    appUpdateInfo.version,
    localVariant,
    navigation,
  ]);

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
