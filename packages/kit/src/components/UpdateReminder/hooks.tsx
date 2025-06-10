import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Dialog,
  LottieView,
  Toast,
  YStack,
  useInTabDialog,
} from '@onekeyhq/components';
import UpdateNotificationDark from '@onekeyhq/kit/assets/animations/update-notification-dark.json';
import UpdateNotificationLight from '@onekeyhq/kit/assets/animations/update-notification-light.json';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppUpdateStatus,
  isFirstLaunchAfterUpdated,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  downloadASC as NativeDownloadASC,
  downloadPackage as NativeDownloadPackage,
  manualInstallPackage as NativeManualInstallPackage,
  verifyASC as NativeVerifyASC,
  verifyPackage as NativeVerifyPackage,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { whenAppUnlocked } from '../../utils/passwordUtils';

const MIN_EXECUTION_DURATION = 3000; // 3 seconds minimum execution time

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
  const navigation = useAppNavigation();

  const verifyPackage = useCallback(async () => {
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed();
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.verifyPackage();
      await Promise.all([
        NativeVerifyPackage(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
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
      await Promise.all([
        NativeVerifyASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
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
      await Promise.all([
        NativeDownloadASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      await verifyASC();
    } catch (e) {
      await backgroundApiProxy.serviceAppUpdate.downloadASCFailed(e as Error);
    }
  }, [verifyASC]);

  const downloadPackage = useCallback(async () => {
    try {
      await backgroundApiProxy.serviceAppUpdate.downloadPackage();
      const params = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
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
  }, [downloadASC, intl]);

  const resetToInComplete = useCallback(async () => {
    await backgroundApiProxy.serviceAppUpdate.resetToInComplete();
  }, []);

  const showUpdateInCompleteDialog = useCallback(
    ({
      onConfirm,
      onCancel,
    }: {
      onConfirm?: () => void;
      onCancel?: () => void;
    }) => {
      Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.update_update_incomplete_text,
        }),
        icon: 'InfoCircleOutline',
        description: intl.formatMessage({
          id: ETranslations.update_update_incomplete_package_missing_desc,
        }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.update_update_now,
        }),
        onConfirm: () => {
          void downloadPackage();
          onConfirm?.();
        },
        onCancelText: intl.formatMessage({
          id: ETranslations.global_later,
        }),
        onCancel: () => {
          void resetToInComplete();
          onCancel?.();
        },
      });
    },
    [downloadPackage, intl, resetToInComplete],
  );

  const manualInstallPackage = useCallback(async () => {
    const params = await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
    try {
      await NativeManualInstallPackage({
        ...params,
        buildNumber: String(platformEnv.buildNumber || 1),
      });
    } catch (e) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_update_failed,
        }),
      });
      await backgroundApiProxy.serviceAppUpdate.resetToInComplete();
      showUpdateInCompleteDialog({
        onConfirm: () => {
          navigation.popStack();
        },
      });
    }
  }, [intl, navigation, showUpdateInCompleteDialog]);

  return useMemo(
    () => ({
      downloadPackage,
      verifyPackage,
      verifyASC,
      downloadASC,
      resetToInComplete,
      manualInstallPackage,
      showUpdateInCompleteDialog,
    }),
    [
      downloadASC,
      downloadPackage,
      resetToInComplete,
      manualInstallPackage,
      showUpdateInCompleteDialog,
      verifyASC,
      verifyPackage,
    ],
  );
};

let isFirstLaunch = true;
export const useAppUpdateInfo = (isFullModal = false, autoCheck = true) => {
  const intl = useIntl();
  const themeVariant = useThemeVariant();
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const navigation = useAppNavigation();
  const {
    downloadPackage,
    verifyPackage,
    verifyASC,
    downloadASC,
    showUpdateInCompleteDialog,
  } = useDownloadPackage();
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

  const dialog = useInTabDialog();
  const showUpdateDialog = useCallback(
    (
      isFull = false,
      params?: {
        latestVersion?: string;
        isForceUpdate?: boolean;
        summary?: string;
      },
    ) => {
      dialog.show({
        dismissOnOverlayPress: false,
        renderIcon: (
          <YStack
            borderRadius="$5"
            borderCurve="continuous"
            borderWidth={StyleSheet.hairlineWidth}
            borderColor="$borderSubdued"
            elevation={platformEnv.isNativeAndroid ? undefined : 0.5}
            overflow="hidden"
          >
            <LottieView
              loop={false}
              height={56}
              width={56}
              source={
                themeVariant === 'light'
                  ? UpdateNotificationLight
                  : UpdateNotificationDark
              }
            />
          </YStack>
        ),
        title: intl.formatMessage({
          id: ETranslations.update_notification_dialog_title,
        }),
        description:
          params?.summary ||
          intl.formatMessage({
            id: ETranslations.update_notification_dialog_desc,
          }),
        onConfirmText: intl.formatMessage({
          id: ETranslations.update_update_now,
        }),
        showCancelButton: false,
        onHeaderCloseButtonPress: () => {
          console.log('onHeaderCloseButtonPress');
          defaultLogger.app.component.closedInUpdateDialog();
        },
        onConfirm: () => {
          setTimeout(() => {
            toUpdatePreviewPage(isFull, params);
          }, 120);
          defaultLogger.app.component.confirmedInUpdateDialog();
        },
      });
    },
    [dialog, intl, themeVariant, toUpdatePreviewPage],
  );

  // run only once
  useEffect(() => {
    if (!autoCheck) {
      return;
    }
    if (isFirstLaunchAfterUpdated(appUpdateInfo)) {
      onViewReleaseInfo();
    }
    if (appUpdateInfo.status === EAppUpdateStatus.updateIncomplete) {
      // do nothing
    } else if (appUpdateInfo.status === EAppUpdateStatus.downloadPackage) {
      void downloadPackage();
    } else if (appUpdateInfo.status === EAppUpdateStatus.downloadASC) {
      void downloadASC();
    } else if (appUpdateInfo.status === EAppUpdateStatus.verifyASC) {
      void verifyASC();
    } else if (appUpdateInfo.status === EAppUpdateStatus.verifyPackage) {
      void verifyPackage();
    } else {
      void checkForUpdates().then(
        async ({ isNeedUpdate: needUpdate, isForceUpdate, response }) => {
          if (needUpdate) {
            if (isForceUpdate) {
              toUpdatePreviewPage(true, response);
            } else if (
              !platformEnv.isDev &&
              (platformEnv.isNative || platformEnv.isDesktop) &&
              response?.isShowUpdateDialog &&
              isFirstLaunch
            ) {
              isFirstLaunch = false;
              await whenAppUnlocked();
              setTimeout(() => {
                showUpdateDialog(false, response);
              }, 200);
            }
          }
        },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onUpdateAction = useCallback(() => {
    switch (appUpdateInfo.status) {
      case EAppUpdateStatus.done:
      case EAppUpdateStatus.notify:
        toUpdatePreviewPage(isFullModal);
        break;
      case EAppUpdateStatus.updateIncomplete:
        showUpdateInCompleteDialog({});
        break;
      case EAppUpdateStatus.manualInstall:
        navigation.pushModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.ManualInstall,
        });
        break;
      default:
        toDownloadAndVerifyPage();
        break;
    }
  }, [
    appUpdateInfo.status,
    isFullModal,
    navigation,
    showUpdateInCompleteDialog,
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
