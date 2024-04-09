import { useCallback, useEffect, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  isFirstLaunchAfterUpdated,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
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

export const useAppUpdateInfo = (isFullModal = false) => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const navigation = useAppNavigation();
  const localVariant = useLocaleVariant();

  const onViewReleaseInfo = useCallback(() => {
    setTimeout(() => {
      const pushModal = isFullModal
        ? navigation.pushFullModal
        : navigation.pushModal;
      pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.WhatsNew,
        params: {
          version: appUpdateInfo.version,
          changeLog: getChangeLog(appUpdateInfo, localVariant),
        },
      });
    });
  }, [
    appUpdateInfo,
    isFullModal,
    localVariant,
    navigation.pushFullModal,
    navigation.pushModal,
  ]);

  // run only once
  useEffect(() => {
    if (isFirstLaunchAfterUpdated(appUpdateInfo)) {
      onViewReleaseInfo();
    }
    void backgroundApiProxy.ServiceAppUpdate.fetchAppUpdateInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
        {
          const changeLog = getChangeLog(appUpdateInfo, localVariant);
          const pushModal = isFullModal
            ? navigation.pushFullModal
            : navigation.pushModal;
          pushModal(EModalRoutes.AppUpdateModal, {
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
    appUpdateInfo,
    isFullModal,
    localVariant,
    navigation.pushFullModal,
    navigation.pushModal,
  ]);

  return useMemo(
    () =>
      isNeedUpdate(appUpdateInfo.version, appUpdateInfo.latestVersion)
        ? {
            data: appUpdateInfo,
            onUpdateAction,
          }
        : {
            version: appUpdateInfo.version,
            onViewReleaseInfo,
          },
    [appUpdateInfo, onUpdateAction, onViewReleaseInfo],
  );
};
