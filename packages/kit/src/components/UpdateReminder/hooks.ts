import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppUpdateStatus,
  isFirstLaunchAfterUpdated,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  downloadASC as NativeDownloadASC,
  downloadPackage as NativeDownloadPackage,
  verifyASC as NativeVerifyASC,
  verifyPackage as NativeVerifyPackage,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';

export const useAppChangeLog = (version?: string) => {
  const response = usePromiseResult(
    () =>
      version
        ? backgroundApiProxy.serviceAppUpdate.fetchChangeLog()
        : Promise.resolve(null),
    [version],
  );
  return useMemo(() => response.result, [response.result]);
};

export const useDownloadPackage = () => {
  const intl = useIntl();

  const verifyPackage = useCallback(async () => {
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed();
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.verifyPackage();
      await NativeVerifyPackage(params);
      await backgroundApiProxy.serviceAppUpdate.readyToInstall();
    } catch (e) {
      await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed(e as Error);
    }
  }, []);

  const verifyASC = useCallback(async () => {
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyASCFailed();
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.verifyASC();
      await NativeVerifyASC(params);
      await verifyPackage();
    } catch (e) {
      await backgroundApiProxy.serviceAppUpdate.verifyASCFailed(e as Error);
    }
  }, [verifyPackage]);

  const downloadASC = useCallback(async () => {
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.downloadASCFailed();
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.downloadASC();
      await NativeDownloadASC(params);
      await verifyASC();
    } catch (e) {
      await backgroundApiProxy.serviceAppUpdate.downloadASCFailed(e as Error);
    }
  }, [verifyASC]);

  const downloadPackage = useCallback(
    async (params: { downloadUrl?: string; latestVersion?: string }) => {
      try {
        await backgroundApiProxy.serviceAppUpdate.downloadPackage();
        const result = await NativeDownloadPackage(params);
        await backgroundApiProxy.serviceAppUpdate.updateDownloadedEvent({
          ...params,
          ...result,
        });
        await downloadASC();
      } catch (e) {
        await backgroundApiProxy.serviceAppUpdate.downloadPackageFailed(
          e as Error,
        );
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_update_failed,
          }),
        });
      }
    },
    [downloadASC, intl],
  );

  const resetToNotify = useCallback(async () => {
    await backgroundApiProxy.serviceAppUpdate.resetToNotify();
  }, []);

  return useMemo(
    () => ({
      downloadPackage,
      verifyPackage,
      verifyASC,
      downloadASC,
      resetToNotify,
    }),
    [downloadASC, downloadPackage, resetToNotify, verifyASC, verifyPackage],
  );
};

export const useAppUpdateInfo = (isFullModal = false, autoCheck = true) => {
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const navigation = useAppNavigation();
  const { downloadPackage, verifyPackage, verifyASC, downloadASC } =
    useDownloadPackage();
  const onViewReleaseInfo = useCallback(() => {
    if (platformEnv.isE2E) {
      return;
    }
    setTimeout(() => {
      const pushModal = isFullModal
        ? navigation.pushFullModal
        : navigation.pushModal;
      pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.WhatsNew,
      });
    });
  }, [isFullModal, navigation.pushFullModal, navigation.pushModal]);

  const toUpdatePreviewPage = useCallback(
    (
      isFull = false,
      params?: {
        latestVersion?: string;
        isForceUpdate?: boolean;
      },
    ) => {
      const pushModal = isFull
        ? navigation.pushFullModal
        : navigation.pushModal;
      pushModal(EModalRoutes.AppUpdateModal, {
        screen: EAppUpdateRoutes.UpdatePreview,
        params: {
          latestVersion: appUpdateInfo.latestVersion,
          isForceUpdate: appUpdateInfo.isForceUpdate,
          autoClose: isFull,
          ...params,
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

  const toDownloadAndVerifyPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.AppUpdateModal, {
      screen: EAppUpdateRoutes.DownloadVerify,
      params: {
        isForceUpdate: appUpdateInfo.isForceUpdate,
      },
    });
  }, [appUpdateInfo.isForceUpdate, navigation]);

  const checkForUpdates = useCallback(async () => {
    const response =
      await backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
    return {
      isForceUpdate: !!response?.isForceUpdate,
      isNeedUpdate: isNeedUpdate(response?.latestVersion),
      response,
    };
  }, []);

  // run only once
  useEffect(() => {
    if (!autoCheck) {
      return;
    }
    if (isFirstLaunchAfterUpdated(appUpdateInfo)) {
      onViewReleaseInfo();
    }
    if (appUpdateInfo.status === EAppUpdateStatus.downloadPackage) {
      void downloadPackage(appUpdateInfo);
    } else if (appUpdateInfo.status === EAppUpdateStatus.downloadASC) {
      void downloadASC();
    } else if (appUpdateInfo.status === EAppUpdateStatus.verifyASC) {
      void verifyASC();
    } else if (appUpdateInfo.status === EAppUpdateStatus.verifyPackage) {
      void verifyPackage();
    } else {
      void checkForUpdates().then(
        ({ isNeedUpdate: needUpdate, isForceUpdate, response }) => {
          if (isForceUpdate && needUpdate) {
            toUpdatePreviewPage(true, response);
          }
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.notify:
        toUpdatePreviewPage(isFullModal);
        break;
      default:
        toDownloadAndVerifyPage();
        break;
    }
  }, [
    appUpdateInfo,
    isFullModal,
    toDownloadAndVerifyPage,
    toUpdatePreviewPage,
  ]);

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
      checkForUpdates,
    }),
    [
      appUpdateInfo,
      checkForUpdates,
      onUpdateAction,
      onViewReleaseInfo,
      toUpdatePreviewPage,
    ],
  );
};
