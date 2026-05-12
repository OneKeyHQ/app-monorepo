// useDownloadPackage hook — extracted from useAppUpdate.tsx so that
// AppUpdateForeground.tsx can import it without going through useAppUpdate
// (which would close a require cycle, since useAppUpdate.tsx also imports
// useAppUpdateForegroundEffects from AppUpdateForeground.tsx).
//
// This is the orchestration layer for the bundle / app update flow:
// downloadPackage → downloadASC → verifyASC → verifyPackage → readyToInstall,
// plus installPackage / manualInstallPackage / showUpdateInCompleteDialog.

import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast } from '@onekeyhq/components';
import {
  EUpdateFileType,
  getUpdateFileType,
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
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';

import {
  asOptionalString,
  buildSoftwareUpdateParams,
  ensureUpdateAttemptId,
  getUpdateAttemptId,
  rotateUpdateAttemptId,
} from './updateAnalytics';
import {
  extractUpdateErrorCode,
  sanitizeUpdateErrorMessage,
} from './updateErrorTaxonomy';
import { withDownloadMutex } from './updateMutex';
import { runDownloadWithRetry } from './updateRetry';
import { isShowToastError } from './updateStrategy';

const MIN_EXECUTION_DURATION = 3000; // 3 seconds minimum execution time

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
      // get a stable id distinct from prior attempts. Also persist it so
      // the post-install / post-relaunch success event (fired in
      // AppUpdateForeground after JS memory is gone) re-emits the same id.
      const attemptId = rotateUpdateAttemptId();
      void backgroundApiProxy.serviceAppUpdate.setCurrentUpdateAttemptId(
        attemptId,
      );
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
