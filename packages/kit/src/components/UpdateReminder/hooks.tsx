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
  isWhatsNewShown,
  markWhatsNewShown,
} from '@onekeyhq/shared/src/appUpdate';
import type { IAppUpdateInfo } from '@onekeyhq/shared/src/appUpdate';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { ISoftwareUpdateParams } from '@onekeyhq/shared/src/logger/scopes/app/scenes/appUpdate';
import type { IDownloadPackageParams } from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import {
  AppUpdate,
  BundleUpdate,
} from '@onekeyhq/shared/src/modules3rdParty/auto-update';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getRequestHeaders } from '@onekeyhq/shared/src/request/Interceptor';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { runAfterTokensDone } from '../../hooks/useRunAfterTokensDone';
import { whenAppUnlocked } from '../../utils/passwordUtils';

import type { IntlShape } from 'react-intl';

function getUpdatePlatform() {
  if (platformEnv.isNativeIOS) return 'ios';
  if (platformEnv.isNativeAndroid) return 'android';
  if (platformEnv.isDesktop) return 'desktop';
  if (platformEnv.isExtension) return 'extension';
  return 'web';
}

const updateStrategyMap: Record<EUpdateStrategy, string> = {
  [EUpdateStrategy.silent]: 'silent',
  [EUpdateStrategy.force]: 'force',
  [EUpdateStrategy.manual]: 'manual',
  [EUpdateStrategy.seamless]: 'seamless',
};

function asOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return String(value);
}

function asString(value: unknown): string {
  return asOptionalString(value) ?? '';
}

function buildSoftwareUpdateParams(
  fileType: EUpdateFileType,
  appUpdateInfo: IAppUpdateInfo,
  attemptId?: string,
): ISoftwareUpdateParams {
  const isBundle = fileType === EUpdateFileType.jsBundle;
  return {
    attemptId: attemptId ?? generateUUID(),
    updateType: isBundle ? 'bundle' : 'app',
    fromVersion: isBundle
      ? asString(platformEnv.bundleVersion)
      : asString(platformEnv.version),
    toVersion: isBundle
      ? asString(appUpdateInfo.jsBundleVersion)
      : asString(appUpdateInfo.latestVersion),
    updateStrategy:
      updateStrategyMap[appUpdateInfo.updateStrategy] ?? 'unknown',
    platform: getUpdatePlatform(),
  };
}

// shared across the entire update flow so all step events carry the same attemptId
let currentUpdateAttemptId: string | undefined;

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

  const getSkipGPGVerification = useCallback(
    async (isJsBundle: boolean): Promise<boolean> => {
      if (!isJsBundle) {
        return false;
      }
      const isSkipGpgVerificationAllowed =
        await BundleUpdate.isSkipGpgVerificationAllowed().catch(() => false);
      if (!isSkipGpgVerificationAllowed) {
        return false;
      }
      return backgroundApiProxy.serviceDevSetting.getSkipBundleGPGVerification();
    },
    [],
  );

  const installPackage = useCallback(
    async (onSuccess: () => void, onFail: () => void) => {
      const data = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      const fileType = await getFileTypeFromUpdateInfo();
      const showToastError = isShowToastError(data.updateStrategy);
      try {
        defaultLogger.app.appUpdate.startInstallPackage({ fileType, data });
        if (fileType === EUpdateFileType.jsBundle) {
          if (!data.downloadedEvent) {
            throw new OneKeyError('NOT_FOUND_PACKAGE');
          }
          await BundleUpdate.installBundle(data.downloadedEvent);
        } else {
          await AppUpdate.installPackage(data);
        }
        defaultLogger.app.appUpdate.endInstallPackage(true);
        onSuccess();
      } catch (e: unknown) {
        defaultLogger.app.appUpdate.endInstallPackage(false, e as Error);
        defaultLogger.app.appUpdate.softwareUpdateResult({
          ...buildSoftwareUpdateParams(fileType, data, currentUpdateAttemptId),
          status: 'failed',
          failedStep: 'install',
          errorMessage: (e as Error)?.message,
        });
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
      const skipGPGVerification = await getSkipGPGVerification(
        fileType === EUpdateFileType.jsBundle,
      );
      defaultLogger.app.appUpdate.startVerifyPackage(params);
      await backgroundApiProxy.serviceAppUpdate.verifyPackage();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.verifyBundle({
              ...params,
              skipGPGVerification,
            })
          : AppUpdate.verifyPackage(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      await backgroundApiProxy.serviceAppUpdate.readyToInstall();
      defaultLogger.app.appUpdate.endVerifyPackage(true);
    } catch (e) {
      defaultLogger.app.appUpdate.endVerifyPackage(false, e as Error);
      defaultLogger.app.appUpdate.softwareUpdateResult({
        ...buildSoftwareUpdateParams(
          fileType,
          appUpdateInfo,
          currentUpdateAttemptId,
        ),
        status: 'failed',
        failedStep: 'verifyPackage',
        errorMessage: (e as Error)?.message,
      });
      await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed(e as Error);
    }
  }, [getSkipGPGVerification]);

  const verifyASC = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.verifyASCFailed();
        return;
      }
      const skipGPGVerification = await getSkipGPGVerification(
        fileType === EUpdateFileType.jsBundle,
      );
      defaultLogger.app.appUpdate.startVerifyASC(params);
      await backgroundApiProxy.serviceAppUpdate.verifyASC();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.verifyBundleASC({
              ...params,
              skipGPGVerification,
            })
          : AppUpdate.verifyASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      defaultLogger.app.appUpdate.endVerifyASC(true);
      await verifyPackage();
    } catch (e) {
      const appUpdateInfo =
        await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      defaultLogger.app.appUpdate.endVerifyASC(false, e as Error);
      defaultLogger.app.appUpdate.softwareUpdateResult({
        ...buildSoftwareUpdateParams(
          fileType,
          appUpdateInfo,
          currentUpdateAttemptId,
        ),
        status: 'failed',
        failedStep: 'verifyASC',
        errorMessage: (e as Error)?.message,
      });
      await backgroundApiProxy.serviceAppUpdate.verifyASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, getSkipGPGVerification, verifyPackage]);

  const downloadASC = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      const params =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      if (!params) {
        await backgroundApiProxy.serviceAppUpdate.downloadASCFailed();
        return;
      }
      const skipGPGVerification = await getSkipGPGVerification(
        fileType === EUpdateFileType.jsBundle,
      );
      defaultLogger.app.appUpdate.startDownloadASC(params);
      await backgroundApiProxy.serviceAppUpdate.downloadASC();
      await Promise.all([
        fileType === EUpdateFileType.jsBundle
          ? BundleUpdate.downloadBundleASC({
              ...params,
              skipGPGVerification,
            })
          : AppUpdate.downloadASC(params),
        timerUtils.wait(MIN_EXECUTION_DURATION),
      ]);
      defaultLogger.app.appUpdate.endDownloadASC(true);
      await verifyASC();
    } catch (e) {
      const appUpdateInfo =
        await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      defaultLogger.app.appUpdate.endDownloadASC(false, e as Error);
      defaultLogger.app.appUpdate.softwareUpdateResult({
        ...buildSoftwareUpdateParams(
          fileType,
          appUpdateInfo,
          currentUpdateAttemptId,
        ),
        status: 'failed',
        failedStep: 'downloadASC',
        errorMessage: (e as Error)?.message,
      });
      await backgroundApiProxy.serviceAppUpdate.downloadASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, getSkipGPGVerification, verifyASC]);

  const downloadPackage = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    const params = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
    currentUpdateAttemptId = generateUUID();
    const softwareUpdateParams = buildSoftwareUpdateParams(
      fileType,
      params,
      currentUpdateAttemptId,
    );
    defaultLogger.app.appUpdate.softwareUpdateStarted(softwareUpdateParams);
    defaultLogger.app.appUpdate.startCheckForUpdates(
      fileType,
      params.updateStrategy,
    );
    const showToastError = isShowToastError(params.updateStrategy);
    try {
      await backgroundApiProxy.serviceAppUpdate.downloadPackage();
      const { latestVersion, jsBundleVersion, jsBundle, downloadUrl } = params;
      const isJsBundle = fileType === EUpdateFileType.jsBundle;
      const skipGPGVerification = await getSkipGPGVerification(isJsBundle);
      const updateEvent =
        await backgroundApiProxy.serviceAppUpdate.getDownloadEvent();
      const headers = await getRequestHeaders();
      const downloadParams: IDownloadPackageParams = {
        ...updateEvent,
        signature: isJsBundle
          ? asOptionalString(jsBundle?.signature)
          : undefined,
        latestVersion: asOptionalString(latestVersion),
        bundleVersion: isJsBundle
          ? asOptionalString(jsBundleVersion)
          : undefined,
        downloadUrl: isJsBundle
          ? asOptionalString(jsBundle?.downloadUrl)
          : asOptionalString(downloadUrl),
        fileSize: isJsBundle ? jsBundle?.fileSize : (params.fileSize ?? 0),
        sha256: isJsBundle ? asOptionalString(jsBundle?.sha256) : undefined,
        skipGPGVerification: isJsBundle ? skipGPGVerification : undefined,
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
      defaultLogger.app.appUpdate.softwareUpdateResult({
        ...softwareUpdateParams,
        status: 'failed',
        failedStep: 'download',
        errorMessage: (e as Error)?.message,
      });
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
  }, [downloadASC, getFileTypeFromUpdateInfo, getSkipGPGVerification, intl]);

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
    const fileType = await getFileTypeFromUpdateInfo();
    try {
      defaultLogger.app.appUpdate.startManualInstallPackage(params);
      if (!params) {
        throw new OneKeyError('No download event found');
      }
      if (fileType === EUpdateFileType.jsBundle) {
        await BundleUpdate.installBundle(params);
      } else {
        await AppUpdate.manualInstallPackage({
          ...params,
          buildNumber: String(platformEnv.buildNumber || 1),
        });
      }
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
  }, [getFileTypeFromUpdateInfo, intl, navigation, showUpdateInCompleteDialog]);

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
    installPackage,
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
    const { shouldUpdate, fileType, isRollback } = isNeedUpdate({
      latestVersion: response?.latestVersion,
      jsBundleVersion: response?.jsBundleVersion,
      status: response?.status,
    });
    const updateStrategy = response?.updateStrategy ?? EUpdateStrategy.manual;
    const result = {
      isForceUpdate: isForceUpdateStrategy(updateStrategy),
      isNeedUpdate: shouldUpdate,
      isRollback,
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
        jsBundleVersion?: string;
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
            const fileType = getUpdateFileType({
              latestVersion:
                params?.latestVersion ?? currentUpdateInfo.latestVersion,
              jsBundleVersion:
                params?.jsBundleVersion ?? currentUpdateInfo.jsBundleVersion,
            });
            if (
              !platformEnv.isExtension &&
              params?.storeUrl &&
              fileType === EUpdateFileType.appShell
            ) {
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
    let cancelled = false;
    let hasTriggeredUpdateCheck = false;
    let cleanupUpdateCheck: (() => void) | undefined;

    const fetchUpdateInfo = (_trigger: string) => {
      void checkForUpdates().then(
        async ({
          isNeedUpdate: needUpdate,
          isForceUpdate,
          isRollback,
          response,
        }) => {
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
          } else if (
            isRollback &&
            response?.status === EAppUpdateStatus.notify
          ) {
            // Rollback always auto-downloads regardless of server strategy —
            // it is a corrective action, not a user-facing update.
            // Guard on status===notify to prevent retry loops:
            // startFailedRecoveryTimer resets failed → notify with a
            // per-target retry limit; after MAX_FAILED_RECOVERY_RETRY the
            // target is frozen/ignored so status never reaches notify again.
            void downloadPackage();
          }
        },
      );
    };

    const scheduleFetchUpdateInfo = () => {
      if (cancelled || hasTriggeredUpdateCheck || cleanupUpdateCheck) {
        return;
      }

      const triggerFetch = (trigger: string) => {
        if (cancelled || hasTriggeredUpdateCheck) return;
        hasTriggeredUpdateCheck = true;
        cleanupUpdateCheck?.();
        cleanupUpdateCheck = undefined;
        fetchUpdateInfo(trigger);
      };

      cleanupUpdateCheck = runAfterTokensDone({
        onRun: (trigger) => triggerFetch(trigger),
      });
    };

    if (isFirstLaunchAfterUpdated(appUpdateInfo)) {
      const fileType = getUpdateFileType(appUpdateInfo);
      defaultLogger.app.appUpdate.softwareUpdateResult({
        ...buildSoftwareUpdateParams(fileType, appUpdateInfo),
        status: 'success',
      });
      const whatsNewAlreadyShown = isWhatsNewShown();
      // Don't use fileType here — getUpdateFileType compares against the
      // already-updated running version (current == target), so it always
      // returns appShell for completed updates. Determine the type directly
      // from appUpdateInfo instead.
      markWhatsNewShown(Boolean(appUpdateInfo.jsBundleVersion));
      if (
        appUpdateInfo.updateStrategy !== EUpdateStrategy.seamless &&
        !whatsNewAlreadyShown
      ) {
        onViewReleaseInfo();
      }
      setTimeout(async () => {
        await backgroundApiProxy.serviceAppUpdate.refreshUpdateStatus();
        scheduleFetchUpdateInfo();
      }, 250);
      return () => {
        cancelled = true;
        cleanupUpdateCheck?.();
        cleanupUpdateCheck = undefined;
      };
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
      if (appUpdateInfo.updateStrategy === EUpdateStrategy.seamless) {
        if (fileType === EUpdateFileType.jsBundle) {
          // Only install if signature verification data is present
          if (
            appUpdateInfo.downloadedEvent?.signature &&
            appUpdateInfo.downloadedEvent?.sha256
          ) {
            void BundleUpdate.installBundle(appUpdateInfo.downloadedEvent);
          } else {
            defaultLogger.app.appUpdate.endInstallPackage(
              false,
              new Error('Missing signature or sha256 for seamless install'),
            );
            void backgroundApiProxy.serviceAppUpdate.reset();
          }
        } else {
          void installPackage(
            () => undefined,
            () => {
              void backgroundApiProxy.serviceAppUpdate.resetToInComplete();
            },
          );
        }
      } else if (appUpdateInfo.updateStrategy === EUpdateStrategy.silent) {
        showSilentUpdateDialog();
      } else {
        showUpdateDialog();
      }
    } else {
      scheduleFetchUpdateInfo();
    }

    return () => {
      cancelled = true;
      cleanupUpdateCheck?.();
      cleanupUpdateCheck = undefined;
    };
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
    installPackage,
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
