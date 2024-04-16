import { useCallback, useEffect, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  isFirstLaunchAfterUpdated,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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
          version: platformEnv.version,
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
    void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
      case EAppUpdateStatus.downloading:
        {
          const changeLog = getChangeLog(appUpdateInfo, localVariant);
          const pushModal = isFullModal
            ? navigation.pushFullModal
            : navigation.pushModal;
          pushModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.UpdatePreview,
            params: {
              version: platformEnv.version,
              latestVersion: appUpdateInfo.latestVersion,
              isForceUpdate: appUpdateInfo.isForceUpdate,
              changeLog,
            },
          });
        }
        break;
      case EAppUpdateStatus.ready:
        if (platformEnv.isDesktop) {
          window.desktopApi.installUpdate();
        }
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
      isNeedUpdate(appUpdateInfo.latestVersion)
        ? {
            data: appUpdateInfo,
            onUpdateAction,
          }
        : {
            version: platformEnv.version,
            onViewReleaseInfo,
          },
    [appUpdateInfo, onUpdateAction, onViewReleaseInfo],
  );
};
