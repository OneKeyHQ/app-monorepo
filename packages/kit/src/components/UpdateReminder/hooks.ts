import { useCallback, useEffect, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { EAppUpdateStatus, isFirstLaunchAfterUpdated, isNeedUpdate } from '@onekeyhq/shared/src/appUpdate';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useLocaleVariant } from '../../hooks/useLocaleVariant';

const getChangeLog = (
  appUpdateInfo: IAppUpdateInfo,
  localVariant: ILocaleSymbol,
) =>
  appUpdateInfo.changeLog?.[localVariant] || appUpdateInfo.changeLog?.['en-US'];

export const useAppUpdateInfo = () => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const navigation = useAppNavigation();
  const localVariant = useLocaleVariant();

  // run only once
  useEffect(() => {
    if (isFirstLaunchAfterUpdated(appUpdateInfo)) {
      setTimeout(() => {
        navigation.pushFullModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.WhatsNew,
          params: {
            version: appUpdateInfo.version,
            changeLog: getChangeLog(appUpdateInfo, localVariant),
          },
        });
      });
    }
    void backgroundApiProxy.ServiceAppUpdate.fetchAppUpdateInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
        {
          const changeLog = getChangeLog(appUpdateInfo, localVariant);
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
  }, [appUpdateInfo, localVariant, navigation]);

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
