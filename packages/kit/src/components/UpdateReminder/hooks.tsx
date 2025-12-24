import { useCallback, useEffect, useMemo, useRef } from 'react';

import { noop, throttle } from 'lodash';
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
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IDownloadPackageParams } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { whenAppUnlocked } from '../../utils/passwordUtils';

import type { IntlShape } from 'react-intl';

const MIN_EXECUTION_DURATION = 3000; // 3 seconds minimum execution time
const isShowToastError = (updateStrategy: EUpdateStrategy) => {
  return (
    updateStrategy !== EUpdateStrategy.silent &&
    updateStrategy !== EUpdateStrategy.seamless
  );
};

export const isAutoUpdateStrategy = (updateStrategy: EUpdateStrategy) => {
  return (
    updateStrategy === EUpdateStrategy.silent ||
    updateStrategy === EUpdateStrategy.seamless
  );
};

export const isShowAppUpdateUIWhenUpdating = ({
  updateStrategy,
  updateStatus,
}: {
  updateStrategy: EUpdateStrategy;
  updateStatus: EAppUpdateStatus;
}) => {
  if (updateStrategy === EUpdateStrategy.seamless) {
    return false;
  }
  if (
    updateStrategy === EUpdateStrategy.manual ||
    updateStrategy === EUpdateStrategy.force
  ) {
    return true;
  }
  return updateStatus === EAppUpdateStatus.ready;
};

export const isForceUpdateStrategy = (updateStrategy: EUpdateStrategy) => {
  return updateStrategy === EUpdateStrategy.force;
};

export const useAppChangeLog = () => {
  const response = usePromiseResult(
    () => backgroundApiProxy.serviceAppUpdate.fetchChangeLog(),
    [],
  );
  return useMemo(() => response.result, [response.result]);
};

function LottieViewIcon({ themeVariant }: { themeVariant: 'light' | 'dark' }) {
  const lottieViewRef = useRef<{
    play?: () => void;
  } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      lottieViewRef.current?.play?.();
    }, 550);
    return () => clearTimeout(timer);
  }, []);

  return (
    <YStack
      borderRadius="$5"
      borderCurve="continuous"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      elevation={platformEnv.isNativeAndroid ? undefined : 0.5}
      overflow="hidden"
    >
      <LottieView
        ref={lottieViewRef as any}
        loop={false}
        autoPlay={false}
        height={56}
        width={56}
        source={
          themeVariant === 'light'
            ? UpdateNotificationLight
            : UpdateNotificationDark
        }
      />
    </YStack>
  );
}

const DIALOG_THROTTLE_TIME = timerUtils.getTimeDurationMs({
  seconds: 30,
});
const UPDATE_DIALOG_INTERVAL = timerUtils.getTimeDurationMs({
  day: 1,
});

const showSilentUpdateDialogUI = throttle(
  async ({
    intl,
    summary,
    onConfirm,
    themeVariant,
  }: {
    intl: IntlShape;
    summary: string;
    onConfirm: () => void;
    themeVariant: 'light' | 'dark';
  }) => {
    Dialog.show({
      dismissOnOverlayPress: false,
      renderIcon: <LottieViewIcon themeVariant={themeVariant} />,
      title: intl.formatMessage({
        id: ETranslations.update_notification_dialog_title,
      }),
      description:
        summary ||
        intl.formatMessage({
          id: ETranslations.update_notification_dialog_desc,
        }),
      onConfirmText: intl.formatMessage({
        id: ETranslations.update_update_now,
      }),
      showCancelButton: false,
      onHeaderCloseButtonPress: () => {
        defaultLogger.app.component.closedInUpdateDialog();
      },
      onConfirm,
    });
  },
  DIALOG_THROTTLE_TIME,
);

const showUpdateDialogUI = ({
  dialog,
  intl,
  themeVariant,
  summary,
  lastUpdateDialogShownAt,
  onConfirm,
}: {
  dialog: ReturnType<typeof useInTabDialog>;
  themeVariant: 'light' | 'dark';
  intl: IntlShape;
  summary: string;
  lastUpdateDialogShownAt?: number;
  onConfirm: () => void;
}) => {
  const now = Date.now();
  if (
    lastUpdateDialogShownAt &&
    now - lastUpdateDialogShownAt < UPDATE_DIALOG_INTERVAL
  ) {
    return;
  }
  void backgroundApiProxy.serviceAppUpdate.updateLastDialogShownAt();

  dialog.show({
    dismissOnOverlayPress: false,
    renderIcon: <LottieViewIcon themeVariant={themeVariant} />,
    title: intl.formatMessage({
      id: ETranslations.update_notification_dialog_title,
    }),
    description:
      summary ||
      intl.formatMessage({
        id: ETranslations.update_notification_dialog_desc,
      }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.update_update_now,
    }),
    showCancelButton: false,
    onHeaderCloseButtonPress: () => {
      defaultLogger.app.component.closedInUpdateDialog();
    },
    onConfirm,
  });
};

export const useDownloadPackage = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const themeVariant = useThemeVariant();
  const showUpdateInCompleteDialogRef =
    useRef<
      ({
        onConfirm,
        onCancel,
      }: {
        onConfirm?: () => void;
        onCancel?: () => void;
      }) => void
    >(noop);

  const getFileTypeFromUpdateInfo = useCallback(async () => {
    const appUpdateInfo =
      await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
    return getUpdateFileType(appUpdateInfo);
  }, []);

  const installPackage = useCallback(
    async (onSuccess: () => void, onFail: () => void) => {
      const data = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      const fileType = await getFileTypeFromUpdateInfo();
      const showToastError = isShowToastError(data.updateStrategy);
      try {
        defaultLogger.app.appUpdate.startInstallPackage({ fileType, data });
        if (fileType === EUpdateFileType.jsBundle) {
          if (!data.downloadedEvent) {
            onFail();
            return;
          }
          await BundleUpdate.installBundle(data.downloadedEvent);
        } else {
          await AppUpdate.installPackage(data);
        }
        defaultLogger.app.appUpdate.endInstallPackage(true);
        onSuccess();
      } catch (e: unknown) {
        defaultLogger.app.appUpdate.endInstallPackage(false, e as Error);
        if ((e as { message?: string })?.message === 'NOT_FOUND_PACKAGE') {
          onFail();
        } else if (showToastError) {
          Toast.error({ title: (e as Error).message });
        }
      }
    },
    [getFileTypeFromUpdateInfo],
  );

  const showSilentUpdateDialog = useCallback(() => {
    setTimeout(async () => {
      const currentUpdateInfo =
        await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      await whenAppUnlocked();
      await showSilentUpdateDialogUI({
        intl,
        summary: currentUpdateInfo.summary || '',
        themeVariant,
        onConfirm: () => {
          navigation.pushModal(EModalRoutes.AppUpdateModal, {
            screen: EAppUpdateRoutes.DownloadVerify,
          });
        },
      });
    }, 0);
  }, [intl, navigation, themeVariant]);

  const verifyPackage = useCallback(async () => {
    const appUpdateInfo =
      await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();

    const fileType = getUpdateFileType(appUpdateInfo);
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed();
        return;
      }
      defaultLogger.app.appUpdate.startVerifyPackage(params);
      await backgroundApiProxy.serviceAppUpdate.verifyPackage();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.verifyBundle(params)
          : AppUpdate.verifyPackage(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      await backgroundApiProxy.serviceAppUpdate.readyToInstall();
      defaultLogger.app.appUpdate.endVerifyPackage(true);
    } catch (e) {
      defaultLogger.app.appUpdate.endVerifyPackage(false, e as Error);
      await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed(e as Error);
    }
  }, []);

  const verifyASC = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyASCFailed();
        return;
      }
      defaultLogger.app.appUpdate.startVerifyASC(params);
      await backgroundApiProxy.serviceAppUpdate.verifyASC();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.verifyBundleASC(params)
          : AppUpdate.verifyASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      defaultLogger.app.appUpdate.endVerifyASC(true);
      await verifyPackage();
    } catch (e) {
      defaultLogger.app.appUpdate.endVerifyASC(false, e as Error);
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
      defaultLogger.app.appUpdate.startDownloadASC(params);
      await backgroundApiProxy.serviceAppUpdate.downloadASC();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.downloadBundleASC(params)
          : AppUpdate.downloadASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      defaultLogger.app.appUpdate.endDownloadASC(true);
      await verifyASC();
    } catch (e) {
      defaultLogger.app.appUpdate.endDownloadASC(false, e as Error);
      await backgroundApiProxy.serviceAppUpdate.downloadASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, verifyASC]);

  const downloadPackage = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    const params = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
    defaultLogger.app.appUpdate.startCheckForUpdates(
      fileType,
      params.updateStrategy,
    );
    const showToastError = isShowToastError(params.updateStrategy);
    try {
      await backgroundApiProxy.serviceAppUpdate.downloadPackage();
      const { latestVersion, jsBundleVersion, jsBundle, downloadUrl } = params;
      const isJsBundle = fileType === EUpdateFileType.jsBundle;
      const updateEvent =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      const headers = await getRequestHeaders();
      const downloadParams: IDownloadPackageParams = {
        ...updateEvent,
        signature: isJsBundle ? jsBundle?.signature : undefined,
        latestVersion,
        bundleVersion: jsBundleVersion,
        downloadUrl: isJsBundle ? jsBundle?.downloadUrl : downloadUrl,
        fileSize: isJsBundle ? jsBundle?.fileSize : params.fileSize ?? 0,
        sha256: isJsBundle ? jsBundle?.sha256 : undefined,
        headers,
      };
      defaultLogger.app.appUpdate.startDownload(downloadParams);
      const result =
        fileType === EUpdateFileType.jsBundle
          ? await BundleUpdate.downloadBundle(downloadParams)
          : await AppUpdate.downloadPackage(downloadParams);
      defaultLogger.app.appUpdate.endDownload(result || {});
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
      if (showToastError) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_update_failed,
          }),
        });
      }
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
  showUpdateInCompleteDialogRef.current = showUpdateInCompleteDialog;

  const manualInstallPackage = useCallback(async () => {
    const params = await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
    try {
      defaultLogger.app.appUpdate.startManualInstallPackage(params);
      if (!params) {
        throw new OneKeyError('No download event found');
      }
      await AppUpdate.manualInstallPackage({
        ...params,
        buildNumber: String(platformEnv.buildNumber || 1),
      });
      defaultLogger.app.appUpdate.endManualInstallPackage(true);
    } catch (e) {
      defaultLogger.app.appUpdate.endManualInstallPackage(false, e as Error);
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
      installPackage,
      manualInstallPackage,
      showUpdateInCompleteDialog,
      showSilentUpdateDialog,
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
      showSilentUpdateDialog,
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
    showSilentUpdateDialog,
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
      setTimeout(async () => {
        const currentAppUpdateInfo =
          await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
        const pushModal = isFull
          ? navigation.pushFullModal
          : navigation.pushModal;
        pushModal(EModalRoutes.AppUpdateModal, {
          screen: EAppUpdateRoutes.UpdatePreview,
          params: {
            latestVersion:
              params?.latestVersion ?? currentAppUpdateInfo.latestVersion,
            isForceUpdate:
              params?.isForceUpdate ??
              isForceUpdateStrategy(appUpdateInfo.updateStrategy),
            autoClose: isFull,
            ...params,
          },
        });
      }, 0);
    },
    [
      appUpdateInfo.updateStrategy,
      navigation.pushFullModal,
      navigation.pushModal,
    ],
  );

  const toDownloadAndVerifyPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.AppUpdateModal, {
      screen: EAppUpdateRoutes.DownloadVerify,
      params: {
        isForceUpdate: isForceUpdateStrategy(appUpdateInfo.updateStrategy),
      },
    });
  }, [appUpdateInfo.updateStrategy, navigation]);

  const checkForUpdates = useCallback(async () => {
    defaultLogger.app.appUpdate.startCheckForUpdatesOnly();
    const response =
      await backgroundApiProxy.serviceAppUpdate.fetchAppUpdateInfo(true);
    const { shouldUpdate, fileType } = isNeedUpdate({
      latestVersion: response?.latestVersion,
      jsBundleVersion: response?.jsBundleVersion,
      status: response?.status,
    });
    const updateStrategy = response?.updateStrategy ?? EUpdateStrategy.manual;
    const result = {
      isForceUpdate: isForceUpdateStrategy(updateStrategy),
      isNeedUpdate: shouldUpdate,
      updateFileType: fileType,
      response,
    };
    defaultLogger.app.appUpdate.endCheckForUpdates({
      isNeedUpdate: shouldUpdate,
      isForceUpdate: isForceUpdateStrategy(updateStrategy),
      updateFileType: fileType as unknown as string,
    });
    return result;
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
      setTimeout(async () => {
        await whenAppUnlocked();
        const currentUpdateInfo =
          await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
        showUpdateDialogUI({
          dialog,
          intl,
          themeVariant,
          summary: params?.summary || '',
          lastUpdateDialogShownAt: currentUpdateInfo.lastUpdateDialogShownAt,
          onConfirm: () => {
            if (!platformEnv.isExtension && params?.storeUrl) {
              openUrlExternal(params.storeUrl);
            } else {
              setTimeout(async () => {
                const updateInfo =
                  await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
                if (updateInfo.status === EAppUpdateStatus.ready) {
                  toDownloadAndVerifyPage();
                } else {
                  toUpdatePreviewPage(isFull, params);
                }
              }, 120);
            }
            defaultLogger.app.component.confirmedInUpdateDialog();
          },
        });
      }, 0);
    },
    [dialog, intl, themeVariant, toDownloadAndVerifyPage, toUpdatePreviewPage],
  );

  // run only once
  useEffect(() => {
    if (!autoCheck || !isFirstLaunch) {
      return;
    }
    isFirstLaunch = false;
    let isShowForceUpdatePreviewPage = false;

    const fetchUpdateInfo = () => {
      void checkForUpdates().then(
        async ({ isNeedUpdate: needUpdate, isForceUpdate, response }) => {
          if (isShowForceUpdatePreviewPage) {
            return;
          }
          const updateStrategy =
            response?.updateStrategy ?? EUpdateStrategy.manual;
          if (needUpdate) {
            if (isAutoUpdateStrategy(updateStrategy)) {
              void downloadPackage();
            } else if (isForceUpdate) {
              toUpdatePreviewPage(true, response);
            } else if (platformEnv.isNative || platformEnv.isDesktop) {
              setTimeout(() => {
                showUpdateDialog(false, response);
              }, 200);
            }
          }
        },
      );
    };

    if (isFirstLaunchAfterUpdated(appUpdateInfo)) {
      if (appUpdateInfo.updateStrategy !== EUpdateStrategy.seamless) {
        onViewReleaseInfo();
      }
      setTimeout(async () => {
        await backgroundApiProxy.serviceAppUpdate.refreshUpdateStatus();
        fetchUpdateInfo();
      }, 250);
      return;
    }

    const forceUpdate = isForceUpdateStrategy(appUpdateInfo.updateStrategy);
    if (appUpdateInfo.status !== EAppUpdateStatus.done && forceUpdate) {
      isShowForceUpdatePreviewPage = true;
      toUpdatePreviewPage(true, appUpdateInfo);
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
    } else if (appUpdateInfo.status === EAppUpdateStatus.ready) {
      if (isShowForceUpdatePreviewPage) {
        return;
      }
      const fileType = getUpdateFileType(appUpdateInfo);
      if (
        fileType === EUpdateFileType.jsBundle &&
        appUpdateInfo.updateStrategy === EUpdateStrategy.seamless
      ) {
        void BundleUpdate.installBundle(appUpdateInfo.downloadedEvent);
      } else if (appUpdateInfo.updateStrategy === EUpdateStrategy.silent) {
        showSilentUpdateDialog();
      } else {
        showUpdateDialog();
      }
    } else {
      fetchUpdateInfo();
    }
  }, [
    autoCheck,
    appUpdateInfo.status,
    checkForUpdates,
    downloadASC,
    downloadPackage,
    onViewReleaseInfo,
    showSilentUpdateDialog,
    showUpdateDialog,
    toUpdatePreviewPage,
    verifyASC,
    verifyPackage,
    appUpdateInfo,
  ]);

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
