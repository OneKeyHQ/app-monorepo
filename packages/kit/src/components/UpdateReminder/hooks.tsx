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
  EUpdateFileType,
  EUpdateStrategy,
  getUpdateFileType,
  isFirstLaunchAfterUpdated,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IDownloadPackageParams } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
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

  const getFileTypeFromUpdateInfo = useCallback(async () => {
    const appUpdateInfo =
      await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
    return getUpdateFileType(appUpdateInfo);
  }, []);

  const verifyPackage = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed();
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.verifyPackage();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.verifyBundle(params)
          : AppUpdate.verifyPackage(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      await backgroundApiProxy.serviceAppUpdate.readyToInstall();
    } catch (e) {
      await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo]);

  const verifyASC = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyASCFailed();
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.verifyASC();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.verifyBundleASC(params)
          : AppUpdate.verifyASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      await verifyPackage();
    } catch (e) {
      await backgroundApiProxy.serviceAppUpdate.verifyASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, verifyPackage]);

  const downloadASC = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.downloadASCFailed();
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.downloadASC();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.downloadBundleASC(params)
          : AppUpdate.downloadASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      await verifyASC();
    } catch (e) {
      await backgroundApiProxy.serviceAppUpdate.downloadASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, verifyASC]);

  const downloadPackage = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      await backgroundApiProxy.serviceAppUpdate.downloadPackage();
      const { latestVersion, jsBundleVersion, downloadUrl, jsBundle } =
        await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      const isJsBundle = fileType === EUpdateFileType.jsBundle;
      const downloadParams: IDownloadPackageParams = {
        signature: isJsBundle ? jsBundle?.signature : undefined,
        latestVersion,
        bundleVersion: jsBundleVersion,
        downloadUrl: isJsBundle ? jsBundle?.downloadUrl : downloadUrl,
        fileSize: isJsBundle ? jsBundle?.fileSize : undefined,
        sha256: isJsBundle ? jsBundle?.sha256 : undefined,
      };
      const result =
        fileType === EUpdateFileType.jsBundle
          ? await BundleUpdate.downloadBundle(downloadParams)
          : await AppUpdate.downloadPackage(downloadParams);
      if (!result) {
        return;
      }
      await backgroundApiProxy.serviceAppUpdate.updateDownloadedEvent({
        ...downloadParams,
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
  }, [downloadASC, getFileTypeFromUpdateInfo, intl]);

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
      await AppUpdate.manualInstallPackage({
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

  const installPackage = useCallback(
    async (onSuccess: () => void, onFail: () => void) => {
      const data = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      const fileType = await getFileTypeFromUpdateInfo();
      try {
        if (fileType === EUpdateFileType.jsBundle) {
          if (!data.downloadedEvent) {
            onFail();
            return;
          }
          await BundleUpdate.installBundle(data.downloadedEvent);
        } else {
          await AppUpdate.installPackage(data);
        }
        onSuccess();
      } catch (e: unknown) {
        if ((e as { message?: string })?.message === 'NOT_FOUND_PACKAGE') {
          onFail();
        } else {
          Toast.error({ title: (e as Error).message });
        }
      }
    },
    [getFileTypeFromUpdateInfo],
  );

  return useMemo(
    () => ({
      downloadPackage,
      verifyPackage,
      verifyASC,
      downloadASC,
      resetToInComplete,
      installPackage,
      manualInstallPackage,
      showUpdateInCompleteDialog,
    }),
    [
      downloadPackage,
      verifyPackage,
      verifyASC,
      downloadASC,
      resetToInComplete,
      installPackage,
      manualInstallPackage,
      showUpdateInCompleteDialog,
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
          isForceUpdate: appUpdateInfo.updateStrategy === EUpdateStrategy.force,
          autoClose: isFull,
          ...params,
        },
      });
    },
    [
      appUpdateInfo.updateStrategy,
      appUpdateInfo.latestVersion,
      navigation.pushFullModal,
      navigation.pushModal,
    ],
  );

  const toDownloadAndVerifyPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.AppUpdateModal, {
      screen: EAppUpdateRoutes.DownloadVerify,
      params: {
        isForceUpdate: appUpdateInfo.updateStrategy === EUpdateStrategy.force,
      },
    });
  }, [appUpdateInfo.updateStrategy, navigation]);

  const checkForUpdates = useCallback(async () => {
    const response =
      await backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
    const { shouldUpdate, fileType } = isNeedUpdate({
      latestVersion: response?.latestVersion,
      jsBundleVersion: response?.jsBundleVersion,
      status: response?.status,
    });
    return {
      isForceUpdate: response?.updateStrategy === EUpdateStrategy.force,
      isSilentUpdate: response?.updateStrategy === EUpdateStrategy.silent,
      isNeedUpdate: shouldUpdate,
      updateFileType: fileType,
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
        storeUrl?: string;
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
          if (!platformEnv.isExtension && params?.storeUrl) {
            openUrlExternal(params.storeUrl);
          } else {
            setTimeout(() => {
              toUpdatePreviewPage(isFull, params);
            }, 120);
          }
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
        async ({
          isNeedUpdate: needUpdate,
          isForceUpdate,
          isSilentUpdate,
          response,
        }) => {
          if (needUpdate) {
            if (isSilentUpdate) {
              void downloadPackage();
            } else if (isForceUpdate) {
              toUpdatePreviewPage(true, response);
            } else if (
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

  return useMemo(() => {
    const { shouldUpdate, fileType } = isNeedUpdate({
      latestVersion: appUpdateInfo.latestVersion,
      jsBundleVersion: appUpdateInfo.jsBundleVersion,
      status: appUpdateInfo.status,
    });
    return {
      isNeedUpdate: shouldUpdate,
      updateFileType: fileType,
      data: appUpdateInfo,
      onUpdateAction,
      toUpdatePreviewPage,
      onViewReleaseInfo,
      checkForUpdates,
    };
  }, [
    appUpdateInfo,
    checkForUpdates,
    onUpdateAction,
    onViewReleaseInfo,
    toUpdatePreviewPage,
  ]);
};
