import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppUpdateStatus,
  EUpdateFileType,
  EUpdateStrategy,
  getUpdateFileType,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { resolveErrorI18nMessage } from '@onekeyhq/shared/src/errors/utils/electronIpcError';
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

import { useAppUpdateForegroundEffects } from './AppUpdateForeground';
import {
  ensureUpdateAttemptId,
  getUpdateAttemptId,
  rotateUpdateAttemptId,
  asOptionalString,
  buildSoftwareUpdateParams,
} from './updateAnalytics';
import {
  extractUpdateErrorCode,
  sanitizeUpdateErrorMessage,
} from './updateErrorTaxonomy';
import { withDownloadMutex } from './updateMutex';
import { runDownloadWithRetry } from './updateRetry';

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

export const useDownloadPackage = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();

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
      ensureUpdateAttemptId();
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
          ...buildSoftwareUpdateParams(fileType, data, getUpdateAttemptId()),
          status: 'failed',
          failedStep: 'install',
          errorMessage: sanitizeUpdateErrorMessage(e),
          errorCode: extractUpdateErrorCode(e),
        });
        if ((e as { message?: string })?.message === 'NOT_FOUND_PACKAGE') {
          onFail();
        } else if (showToastError) {
          Toast.error({ title: resolveErrorI18nMessage(e, intl) });
        }
      }
    },
    [getFileTypeFromUpdateInfo, intl],
  );

  const verifyPackage = useCallback(async () => {
    const appUpdateInfo =
      await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();

    const fileType = getUpdateFileType(appUpdateInfo);
    ensureUpdateAttemptId();
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
          getUpdateAttemptId(),
        ),
        status: 'failed',
        failedStep: 'verifyPackage',
        errorMessage: sanitizeUpdateErrorMessage(e),
        errorCode: extractUpdateErrorCode(e),
      });
      await backgroundApiProxy.serviceAppUpdate.verifyPackageFailed(e as Error);
    }
  }, [getSkipGPGVerification]);

  const verifyASC = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    ensureUpdateAttemptId();
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
          getUpdateAttemptId(),
        ),
        status: 'failed',
        failedStep: 'verifyASC',
        errorMessage: sanitizeUpdateErrorMessage(e),
        errorCode: extractUpdateErrorCode(e),
      });
      await backgroundApiProxy.serviceAppUpdate.verifyASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, getSkipGPGVerification, verifyPackage]);

  const downloadASC = useCallback(async () => {
    const fileType = await getFileTypeFromUpdateInfo();
    ensureUpdateAttemptId();
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
          getUpdateAttemptId(),
        ),
        status: 'failed',
        failedStep: 'downloadASC',
        errorMessage: sanitizeUpdateErrorMessage(e),
        errorCode: extractUpdateErrorCode(e),
      });
      await backgroundApiProxy.serviceAppUpdate.downloadASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, getSkipGPGVerification, verifyASC]);

  const downloadPackage = useCallback(async () => {
    return withDownloadMutex(async () => {
      const fileType = await getFileTypeFromUpdateInfo();
      const params = await backgroundApiProxy.serviceAppUpdate.getUpdateInfo();
      // Fresh attempt → rotate the attempt id so this download (and any
      // chained downloadASC / verifyASC / verifyPackage / install steps)
      // get a stable id distinct from prior attempts.
      const attemptId = rotateUpdateAttemptId();
      const softwareUpdateParams = buildSoftwareUpdateParams(
        fileType,
        params,
        attemptId,
      );
      defaultLogger.app.appUpdate.softwareUpdateStarted(softwareUpdateParams);
      defaultLogger.app.appUpdate.startCheckForUpdates(
        fileType,
        params.updateStrategy,
      );
      const showToastError = isShowToastError(params.updateStrategy);
      try {
        await backgroundApiProxy.serviceAppUpdate.downloadPackage();
        const { latestVersion, jsBundleVersion, jsBundle, downloadUrl } =
          params;
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
        // Retry transient failures up to 3x with backoff. Each retry reuses
        // the on-disk resume artifact (iOS .resume / Android & Desktop
        // .partial), so the second attempt onward is a real range-resume —
        // not a from-byte-zero re-fetch. Bails immediately on
        // SHA256_MISMATCH / HTTP 4xx-permanent so we don't spin on a known-
        // dead state.
        const result = await runDownloadWithRetry(
          () =>
            fileType === EUpdateFileType.jsBundle
              ? BundleUpdate.downloadBundle(downloadParams)
              : AppUpdate.downloadPackage(downloadParams),
          'downloadPackage',
        );
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
          errorMessage: sanitizeUpdateErrorMessage(e),
          errorCode: extractUpdateErrorCode(e),
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
    });
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
  }, [
    getFileTypeFromUpdateInfo,
    intl,
    navigation,
    showUpdateInCompleteDialog,
  ]);

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

/**
 * Data-only accessor for the app-update atom + derived computations
 * (isNeedUpdate, fileType, action handlers). Side effects that need to
 * run only once per app launch (cold-launch dispatch + AppState 'active'
 * resume listener) live in <AppUpdateForeground />, mounted globally
 * via Bootstrap.tsx. Consumers that just need to display update state
 * use this hook; consumers that need to TRIGGER an update step pull
 * the action they want from useDownloadPackage().
 *
 * `autoCheck` defaults to false in production — the singleton
 * <AppUpdateForeground /> handles cold-launch + AppState side effects.
 * Existing tests that opt in with `(false, true)` continue to exercise
 * the side-effect paths via the same `useAppUpdateForegroundEffects`
 * hook (gated by a module flag so the global mount + test mount don't
 * double-fire when both are present).
 */
export const useAppUpdateInfo = (isFullModal = false, autoCheck = false) => {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  useAppUpdateForegroundEffects(autoCheck);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const navigation = useAppNavigation();

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

  const { downloadPackage, showUpdateInCompleteDialog } = useDownloadPackage();

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
      downloadPackage,
    };
  }, [
    appUpdateInfo,
    checkForUpdates,
    downloadPackage,
    onUpdateAction,
    onViewReleaseInfo,
    toUpdatePreviewPage,
  ]);
};

// Re-export utilities to keep import paths simple for consumers that
// previously pulled these from `UpdateReminder/hooks`.
export {
  sanitizeUpdateErrorMessage,
  extractUpdateErrorCode,
  isUnrecoverableDownloadError,
} from './updateErrorTaxonomy';
export {
  computeDownloadRetryDelayMs,
  runDownloadWithRetry,
} from './updateRetry';
export {
  buildSoftwareUpdateParams,
  ensureUpdateAttemptId,
  rotateUpdateAttemptId,
  getUpdateAttemptId,
  getUpdatePlatform,
  asOptionalString,
  asString,
} from './updateAnalytics';
