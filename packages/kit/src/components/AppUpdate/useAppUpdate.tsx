import { useCallback, useMemo } from 'react';

import { useAppUpdatePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppUpdateStatus,
  EUpdateStrategy,
  isNeedUpdate,
} from '@onekeyhq/shared/src/appUpdate';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAppUpdateRoutes, EModalRoutes } from '@onekeyhq/shared/src/routes';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { tryShowFeaturedDialog } from '../../views/AppUpdate/dialogs/tryShowFeaturedDialog';

import { useAppUpdateForegroundEffects } from './AppUpdateForeground';
import { isForceUpdateStrategy } from './updateStrategy';
import { useDownloadPackage } from './useDownloadPackage';

export const useAppChangeLog = () => {
  const response = usePromiseResult(
    () => backgroundApiProxy.serviceAppUpdate.fetchChangeLog(),
    [],
  );
  return useMemo(() => response.result, [response.result]);
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
  useAppUpdateForegroundEffects(autoCheck);
  const [appUpdateInfo] = useAppUpdatePersistAtom();
  const navigation = useAppNavigation();

  const onViewReleaseInfo = useCallback(() => {
    if (platformEnv.isE2E) {
      return;
    }
    setTimeout(async () => {
      if (await tryShowFeaturedDialog(false)) return;
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
        if (await tryShowFeaturedDialog(true)) return;
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
// previously pulled these from `UpdateReminder/hooks` or directly from
// `./useAppUpdate`. Companion modules now own the implementations; this
// file is the orchestration + barrel.
export {
  isAutoUpdateStrategy,
  isForceUpdateStrategy,
  isShowAppUpdateUIWhenUpdating,
} from './updateStrategy';
export { useDownloadPackage } from './useDownloadPackage';
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
