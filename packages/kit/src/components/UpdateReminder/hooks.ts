import { useCallback, useEffect, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IChangeLog } from '@onekeyhq/shared/src/appUpdate';
import {
  EAppUpdateStatus,
  isFirstLaunchAfterUpdated,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
import type { ILocaleSymbol } from '@onekeyhq/shared/src/locale';
import {
  downloadAPK,
  installAPK,
} from '@onekeyhq/shared/src/modules3rdParty/download-module';
import RNFS from '@onekeyhq/shared/src/modules3rdParty/react-native-fs/index.native';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { useLocaleVariant } from '../../hooks/useLocaleVariant';
import { usePromiseResult } from '../../hooks/usePromiseResult';

const getLocalVariantChangeLog = (
  changeLog: IChangeLog,
  localVariant: ILocaleSymbol,
) => changeLog?.[localVariant] || changeLog?.['en-US'];

export const useAppChangeLog = (version?: string) => {
  const localVariant = useLocaleVariant();
  const response = usePromiseResult(
    () =>
      version
        ? backgroundApiProxy.serviceAppUpdate.fetchChangeLog(version)
        : Promise.resolve(null),
    [version],
  );
  return useMemo(
    () =>
      response.result
        ? getLocalVariantChangeLog(response.result, localVariant)
        : '',
    [localVariant, response.result],
  );
};

export const useAppUpdateInfo = (isFullModal = false) => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const navigation = useAppNavigation();

  const onViewReleaseInfo = useCallback(() => {
    setTimeout(() => {
      const pushModal = isFullModal
        ? navigation.pushFullModal
        : navigation.pushModal;
      pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.WhatsNew,
      });
    });
  }, [isFullModal, navigation.pushFullModal, navigation.pushModal]);

  // run only once
  useEffect(() => {
    if (isFirstLaunchAfterUpdated(appUpdateInfo)) {
      onViewReleaseInfo();
    }
    if (appUpdateInfo.status === EAppUpdateStatus.downloading) {
      if (platformEnv.isNativeAndroid) {
        void downloadAPK(
          appUpdateInfo.downloadUrl || '',
          appUpdateInfo.latestVersion,
        ).then(() => {
          void backgroundApiProxy.serviceAppUpdate.readyToInstall();
        });
      }
      if (platformEnv.isDesktop) {
        // TODO
      }
    }
    void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
      case EAppUpdateStatus.downloading:
        {
          const pushModal = isFullModal
            ? navigation.pushFullModal
            : navigation.pushModal;
          pushModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.UpdatePreview,
            params: {
              latestVersion: appUpdateInfo.latestVersion,
              isForceUpdate: appUpdateInfo.isForceUpdate,
            },
          });
        }
        break;
      case EAppUpdateStatus.ready:
        if (platformEnv.isDesktop) {
          window.desktopApi.installUpdate();
        } else if (platformEnv.isNativeAndroid) {
          void installAPK(appUpdateInfo.latestVersion);
        }
        break;
      default:
        break;
    }
  }, [
    appUpdateInfo,
    isFullModal,
    navigation.pushFullModal,
    navigation.pushModal,
  ]);

  console.log(`${RNFS.CachesDirectoryPath}/apk`);
  return useMemo(
    () => ({
      isNeedUpdate: isNeedUpdate(
        appUpdateInfo.latestVersion,
        appUpdateInfo.status,
      ),
      data: appUpdateInfo,
      onUpdateAction,
      onViewReleaseInfo,
    }),
    [appUpdateInfo, onUpdateAction, onViewReleaseInfo],
  );
};
