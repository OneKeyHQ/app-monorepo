import { useCallback, useEffect, useMemo, useRef } from 'react';

import { noop, throttle } from 'lodash';
import { useIntl } from 'react-intl';
import { AppState, StyleSheet } from 'react-native';

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
import { resolveErrorI18nMessage } from '@onekeyhq/shared/src/errors/utils/electronIpcError';
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

// Defense-in-depth scrubber for free-text error messages before they leave
// the client. The native modules try not to embed PII, but Node.js fs errors
// (ENOENT/EACCES on Desktop) and iOS NSError.localizedDescription can carry
// the user's home-dir path with their OS username, e.g.
//   "ENOENT: no such file ... open '/Users/john/Library/Application Support/OneKey/...'"
// Redacting the username segment here means even an unsanitized native
// payload cannot leak it into Mixpanel.
//
// Patterns redacted:
//   - macOS  /Users/<name>/...           → /Users/<redacted>/...
//   - Windows C:\Users\<name>\...        → C:\Users\<redacted>\...
//   - Linux  /home/<name>/...            → /home/<redacted>/...
//   - macOS  /var/mobile/Containers/...  → /var/mobile/Containers/<redacted>/... (iOS install UUID)
// Also caps total length at 240 chars so a runaway stack trace cannot
// inflate event payloads.
const MAX_ERROR_MESSAGE_LENGTH = 240;
export function sanitizeUpdateErrorMessage(error: unknown): string | undefined {
  const raw =
    typeof error === 'string'
      ? error
      : (error as { message?: string } | null)?.message;
  if (!raw) return undefined;
  let cleaned = raw
    .replace(/(\/Users\/)([^/'"\s]+)/g, '$1<redacted>')
    .replace(/(\\Users\\)([^\\'"\s]+)/g, '$1<redacted>')
    .replace(/(\/home\/)([^/'"\s]+)/g, '$1<redacted>')
    .replace(
      /(\/var\/mobile\/Containers\/(?:Data|Bundle)\/Application\/)([^/'"\s]+)/g,
      '$1<redacted>',
    );
  if (cleaned.length > MAX_ERROR_MESSAGE_LENGTH) {
    cleaned = `${cleaned.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`;
  }
  return cleaned;
}

// Codes that mean a retry will deterministically fail the same way — either
// the server actively rejects us (auth, gone, malformed), or the bytes we
// have on disk are already verified-bad (SHA256 mismatch — partial gets
// wiped, retrying just re-downloads the same bad payload). Bail immediately
// for these so we don't burn three round-trips on a known-dead state.
const UNRECOVERABLE_DOWNLOAD_ERROR_CODES = new Set<string>([
  'SHA256_MISMATCH',
  'HTTP_403',
  'HTTP_404',
  'HTTP_410',
]);
function isUnrecoverableDownloadError(error: unknown): boolean {
  const code = extractUpdateErrorCode(error);
  if (code && UNRECOVERABLE_DOWNLOAD_ERROR_CODES.has(code)) return true;
  // Programmer/config-error throws — extractUpdateErrorCode returns undefined
  // for these because the messages are plain English. Match the canonical
  // set thrown by the native modules.
  const msg = (error as { message?: string } | null)?.message ?? '';
  return (
    msg.includes('Bundle download URL must use HTTPS') ||
    msg.includes('Invalid version string format') ||
    msg.includes('Already downloading') ||
    msg.includes('Invalid URL')
  );
}

const DOWNLOAD_RETRY_MAX_ATTEMPTS = 3;
const DOWNLOAD_RETRY_BASE_DELAY_MS = 1500;
// Visible for testing; main callers go through runDownloadWithRetry.
export function computeDownloadRetryDelayMs(attempt: number): number {
  return (
    DOWNLOAD_RETRY_BASE_DELAY_MS * 2 ** attempt + Math.floor(Math.random() * 500)
  );
}

/**
 * Retries `operation` on transient bundle-update failures (network drops,
 * partial truncation, transient server 5xx) up to DOWNLOAD_RETRY_MAX_ATTEMPTS
 * times with exponential backoff + jitter. The native modules persist their
 * resume artifact (iOS .resume / Android & Desktop .partial) on each failure,
 * so each retry is a true range-resume rather than a from-byte-zero re-fetch.
 *
 * Bails immediately for unrecoverable codes (SHA mismatch, HTTP 403/404/410,
 * config errors) so we don't waste backoff windows on deterministic dead
 * states. Cap of 3 attempts (initial + 3 retries = 4 total round-trips) keeps
 * the worst-case wait under ~14s + jitter.
 */
export async function runDownloadWithRetry<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= DOWNLOAD_RETRY_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (
        isUnrecoverableDownloadError(e) ||
        attempt === DOWNLOAD_RETRY_MAX_ATTEMPTS
      ) {
        throw e;
      }
      const delayMs = computeDownloadRetryDelayMs(attempt);
      defaultLogger.app.appUpdate.log(
        `${context}: retry ${attempt + 1}/${DOWNLOAD_RETRY_MAX_ATTEMPTS} in ${delayMs}ms — code=${
          extractUpdateErrorCode(e) ?? '<none>'
        }`,
      );
      await timerUtils.wait(delayMs);
    }
  }
  throw lastError;
}

// Maps a thrown bundle-update error into a stable, low-cardinality code so
// Mixpanel can aggregate failures by category instead of unique message
// strings. Recognized payloads (in priority order):
//
//   - Native SHA256 subtypes:
//       iOS/Android throw "Bundle SHA256 verification failed: <REASON>"
//       Desktop throws    "Downloaded file is not valid: SHA256_<REASON>"
//     Both normalize to "SHA256_<REASON>".
//   - HTTP failures:        "HTTP 416", "HTTP error 504"      → "HTTP_<code>"
//   - iOS URLSession errors: "NSURLErrorDomain -1005"          → "NSURL_-1005"
//   - Generic IO bubble:    "IO_FileNotFoundException", etc.   → "IO_<class>"
//
// Falls back to undefined so the analytics event simply lacks errorCode
// rather than carrying a noisy free-text string.
export function extractUpdateErrorCode(error: unknown): string | undefined {
  const msg =
    typeof error === 'string'
      ? error
      : (error as { message?: string } | null)?.message ?? '';
  if (!msg) return undefined;

  const sha256 = msg.match(
    /(?:Bundle\s+SHA256\s+verification\s+failed:\s+|SHA256_)([A-Z][A-Z0-9_]*)/,
  );
  if (sha256) return `SHA256_${sha256[1]}`;

  const http = msg.match(/HTTP\s+(?:error\s+)?(\d{3})/i);
  if (http) return `HTTP_${http[1]}`;

  const nsUrl = msg.match(/NSURLErrorDomain[^-\d]*(-?\d+)/);
  if (nsUrl) return `NSURL_${nsUrl[1]}`;

  const io = msg.match(/\b(IO_[A-Za-z][A-Za-z0-9_]*)/);
  if (io) return io[1];

  return undefined;
}

// shared across the entire update flow so all step events carry the same attemptId
let currentUpdateAttemptId: string | undefined;

// JS-process-wide mutex on the downloadPackage hook function. The cold-launch
// useEffect, AppState 'active' listener, and user-driven button clicks can
// all enter `downloadPackage()` concurrently within the same JS tick. Without
// this mutex the second caller hits native's isDownloading guard with
// "Already downloading", which the in-flight retry layer treats as
// unrecoverable — flipping status to downloadPackageFailed mid-flow and
// stranding the original (still healthy) download. Returning the in-flight
// Promise to every concurrent caller collapses them into one logical
// attempt that all observers await together.
let inFlightDownloadPackage: Promise<void> | null = null;

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
        errorMessage: sanitizeUpdateErrorMessage(e),
        errorCode: extractUpdateErrorCode(e),
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
        errorMessage: sanitizeUpdateErrorMessage(e),
        errorCode: extractUpdateErrorCode(e),
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
        errorMessage: sanitizeUpdateErrorMessage(e),
        errorCode: extractUpdateErrorCode(e),
      });
      await backgroundApiProxy.serviceAppUpdate.downloadASCFailed(e as Error);
    }
  }, [getFileTypeFromUpdateInfo, getSkipGPGVerification, verifyASC]);

  const downloadPackage = useCallback(async () => {
    // Concurrent-call mutex: if a downloadPackage attempt is already in
    // flight in this JS process, await its outcome rather than starting a
    // duplicate. This collapses cold-launch + user-click + AppState
    // 'active' races into a single logical attempt and prevents the
    // duplicate path from racing native's isDownloading guard.
    if (inFlightDownloadPackage) {
      return inFlightDownloadPackage;
    }
    const run = async () => {
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
    };
    inFlightDownloadPackage = run().finally(() => {
      inFlightDownloadPackage = null;
    });
    return inFlightDownloadPackage;
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
      // After the update has completed, current == target, so
      // getUpdateFileType always returns appShell. Derive the actual type
      // from appUpdateInfo so bundle (hot-update) successes aren't
      // misclassified as app-shell in analytics.
      const fileType = appUpdateInfo.jsBundleVersion
        ? EUpdateFileType.jsBundle
        : EUpdateFileType.appShell;
      defaultLogger.app.appUpdate.softwareUpdateResult({
        ...buildSoftwareUpdateParams(fileType, appUpdateInfo),
        status: 'success',
      });
      const whatsNewAlreadyShown = isWhatsNewShown();
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

  // Re-arm the download pipeline whenever the user returns to the app,
  // covering two interruption modes that the in-flight retry (C1) cannot
  // catch on its own:
  //   - iOS suspends the foreground URLSession after ~30s in background.
  //     The task fails with -1005 / -1001 and the resume blob is on disk
  //     (via the C3 didEnterBackground snapshot); C1 retries 3x within
  //     ~14s; if all 3 fail, status flips to downloadPackageFailed.
  //   - Android may freeze / kill the JVM under memory pressure with the
  //     stream still in flight. The next foreground pass needs to re-fire
  //     downloadPackage so the on-disk .partial gets resumed via
  //     `Range: bytes=<flushed>-`.
  //
  // Eligibility is gated on the SERVICE side (shouldResumeStalledDownload),
  // which combines a status check + a 30s instance-scoped cooldown so that:
  //   - In-flight downloads (status===downloadPackage) are NEVER disturbed
  //     by a foreground transition — the in-flight retry handles those.
  //   - Verify-failed / install-failed states are NEVER auto-retried —
  //     they need user-facing decisions.
  //   - Multiple listeners (UpdateReminder + MoreActionButton both call
  //     useAppUpdateInfo) cannot double-fire downloadPackage on the same
  //     AppState event, because the cooldown lives on the single service
  //     instance, not on per-mount refs.
  //
  // When the gate returns true, we MUST invoke the JS downloadPackage()
  // hook here — the service method only sets atom status and would NOT
  // start the actual byte transfer. Bytes only flow through
  // BundleUpdate.downloadBundle / AppUpdate.downloadPackage which the
  // hook calls directly.
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state !== 'active') return;
      const should =
        await backgroundApiProxy.serviceAppUpdate.shouldResumeStalledDownload();
      if (should) {
        void downloadPackage();
      }
    });
    return () => sub.remove();
  }, [downloadPackage]);

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
