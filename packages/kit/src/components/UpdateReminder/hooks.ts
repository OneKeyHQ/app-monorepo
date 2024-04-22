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
  downloadPackage,
  installPackage,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

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
      void downloadPackage(appUpdateInfo)
        .then(() => {
          void backgroundApiProxy.serviceAppUpdate.readyToInstall();
        })
        .catch((e: { message: string }) => {
          void backgroundApiProxy.serviceAppUpdate.notifyFailed(e);
        });
    }
    void backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toUpdatePreviewPage = useCallback(
    (isFull = false) => {
      const pushModal = isFull
        ? navigation.pushFullModal
        : navigation.pushModal;
      pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.UpdatePreview,
        params: {
          latestVersion: appUpdateInfo.latestVersion,
          isForceUpdate: appUpdateInfo.isForceUpdate,
          autoClose: isFull,
        },
      });
    },
    [
      appUpdateInfo.isForceUpdate,
      appUpdateInfo.latestVersion,
      navigation.pushFullModal,
      navigation.pushModal,
    ],
  );

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
      case EAppUpdateStatus.downloading:
        toUpdatePreviewPage(isFullModal);
        break;
      case EAppUpdateStatus.ready:
        void installPackage(appUpdateInfo).catch((e) =>
          backgroundApiProxy.serviceAppUpdate.notifyFailed(e),
        );
        break;
      case EAppUpdateStatus.failed:
        openUrlExternal('https://github.com/OneKeyHQ/app-monorepo/releases');
        break;
      default:
        break;
    }
  }, [appUpdateInfo, isFullModal, toUpdatePreviewPage]);

  return useMemo(
    () => ({
      isNeedUpdate: isNeedUpdate(
        appUpdateInfo.latestVersion,
        appUpdateInfo.status,
      ),
      data: appUpdateInfo,
      onUpdateAction,
      toUpdatePreviewPage,
      onViewReleaseInfo,
    }),
    [appUpdateInfo, onUpdateAction, onViewReleaseInfo, toUpdatePreviewPage],
  );
};
