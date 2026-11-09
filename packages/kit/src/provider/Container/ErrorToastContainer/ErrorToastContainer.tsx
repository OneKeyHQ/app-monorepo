import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast, globalNetInfo } from '@onekeyhq/components';
import { closeOneKeyIdLoginDialogs } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdLoginDialogs';
import {
  primePersistAtom,
  usePrimePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  PRIME_USER_BANNED_CODE,
  getLoggedInOneKeyIdUserId,
  primeUserBannedMessage,
} from '@onekeyhq/shared/src/prime/primeUserBanned';
import { subscribeNativeStorageContractViolations } from '@onekeyhq/shared/src/storage/nativeStorageContractViolationSubscription';
import {
  getNativeAppStorageEmergencyStatus,
  subscribeNativeAppStorageEmergencyStatus,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import { getNativeStorageRecoveryToastTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import { getErrorAction } from './ErrorToasts';
import {
  getEffectiveHttpStatusCode,
  getNetworkErrorToastSuppressReason,
} from './offlineNetworkToastGuard';

// Get deduplication ID for HTTP status codes to prevent toast spam
// @param httpStatusCode - HTTP status code (e.g., 403, 429, 503)
const getDeduplicationId = (
  httpStatusCode?: number,
): { id: string | undefined; forceDeduplicate: boolean } => {
  if (!httpStatusCode) return { id: undefined, forceDeduplicate: false };

  // Forbidden - force deduplicate
  if (httpStatusCode === 403)
    return { id: 'error_403', forceDeduplicate: true };

  // Rate limiting - force deduplicate to avoid spam
  if (httpStatusCode === 429)
    return { id: 'error_429', forceDeduplicate: true };

  // Server errors (5xx) - force unified deduplication to prevent toast avalanche
  if (httpStatusCode >= 500 && httpStatusCode < 600) {
    return { id: 'error_5xx', forceDeduplicate: true };
  }

  return { id: undefined, forceDeduplicate: false };
};

// This container is on the web startup graph. isKnownTranslationKey imports
// the translations enum, so a hardware key counts only when the active catalog
// already contains it.
function hasLoadedTranslation(messages: object | undefined, key: string) {
  return !!messages && Object.prototype.hasOwnProperty.call(messages, key);
}

// These errors may cross from a runtime without loaded locale messages.
const MAIN_THREAD_HARDWARE_ERROR_I18N_KEYS = new Set<ETranslations>([
  ETranslations.hardware_device_information_is_inconsistent_it_may_be_caused_by_device_reset,
  ETranslations.hardware_device_passphrase_state_error,
  ETranslations.hardware_device_pin_state_error,
  ETranslations.update_update_in_official_web_tool_desc_copy,
  // The Bluetooth readiness family is raised in the background runtime
  // (the Android pre-check), whose fallback title is the bare class name
  // (OK-62113).
  ETranslations.hardware_bluetooth_need_turned_on_error,
  ETranslations.hardware_bluetooth_requires_permission_error,
  ETranslations.hardware_device_ble_location_disabled,
]);

export function ErrorToastContainer() {
  const intl = useIntl();
  const [primeUser] = usePrimePersistAtom();
  const oneKeyIdUserId = getLoggedInOneKeyIdUserId(primeUser);
  const bannedLoginDialogVisible = useRef(false);

  useEffect(() => {
    if (!platformEnv.isNative) return;
    let warnedEpoch: string | undefined;
    const showEmergencyWarning = () => {
      const status = getNativeAppStorageEmergencyStatus();
      if (!status) {
        warnedEpoch = undefined;
        return;
      }
      if (warnedEpoch === status.epoch) return;
      warnedEpoch = status.epoch;
      Toast.warning({
        title: 'Emergency storage mode',
        duration: 10_000,
        message:
          'Using current MMKV data, which may be incomplete. Legacy data and old transaction evidence are retained. Migration is not complete. Back up your wallets; future recovery must explicitly choose which snapshot to keep.',
      });
    };
    // Locale/provider startup may mount this consumer after the bg snapshot.
    // Subscribe before reading, and repeat the warning on a new app mount.
    const unsubscribe =
      subscribeNativeAppStorageEmergencyStatus(showEmergencyWarning);
    showEmergencyWarning();
    return unsubscribe;
  }, []);

  useEffect(
    () =>
      subscribeNativeStorageContractViolations((violation) => {
        Toast.error({
          title: 'Unsupported AsyncStorage API',
          message: `${violation.apiName} was blocked in the ${violation.runtime} runtime. See the device log for the call stack.`,
          toastId: `native-storage-contract:${violation.runtime}:${violation.apiName}`,
          duration: 10_000,
        });
      }),
    [],
  );

  useEffect(() => {
    const fn = (p: IAppEventBusPayload[EAppEventBusNames.ShowToast]) => {
      const isPrimeUserBanned = Number(p.errorCode) === PRIME_USER_BANNED_CODE;
      if (!p.title && !isPrimeUserBanned) {
        return;
      }
      const isInternetReachable =
        globalNetInfo.currentState().isInternetReachable;
      const suppressReason = getNetworkErrorToastSuppressReason({
        isInternetReachable,
        payload: p,
      });
      const shouldSuppress = suppressReason !== null;
      const statusCodeForDeduplicate = getEffectiveHttpStatusCode(p);
      if (shouldSuppress) {
        return;
      }

      if (isPrimeUserBanned && !oneKeyIdUserId) {
        if (bannedLoginDialogVisible.current) return;
        bannedLoginDialogVisible.current = true;
        void (async () => {
          try {
            await closeOneKeyIdLoginDialogs();
            const currentUser = await primePersistAtom.get();
            if (getLoggedInOneKeyIdUserId(currentUser)) {
              bannedLoginDialogVisible.current = false;
              return;
            }
            Dialog.show({
              title: 'OneKeyID',
              description: intl.formatMessage(primeUserBannedMessage),
              icon: 'ErrorOutline',
              tone: 'warning',
              showCancelButton: false,
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_got_it,
              }),
              confirmButtonProps: {
                testID: 'prime-banned-login-error-confirm-btn',
              },
              dismissOnOverlayPress: false,
              disableDrag: true,
              onClose: () => {
                bannedLoginDialogVisible.current = false;
              },
            });
          } catch {
            bannedLoginDialogVisible.current = false;
            Toast.error({
              title: 'OneKeyID',
              message: intl.formatMessage(primeUserBannedMessage),
              toastId: String(PRIME_USER_BANNED_CODE),
            });
          }
        })();
        return;
      }

      const deduplication = getDeduplicationId(statusCodeForDeduplicate);
      // For critical errors (403, 429, 5xx), force deduplication to prevent toast spam
      // Otherwise, respect custom toastId from caller
      let toastId = deduplication.forceDeduplicate
        ? deduplication.id
        : p.toastId ||
          deduplication.id ||
          (p.errorCode !== undefined ? String(p.errorCode) : undefined) ||
          p.title ||
          p.requestId;
      if (isPrimeUserBanned) toastId = String(PRIME_USER_BANNED_CODE);

      const actions = getErrorAction({
        errorCode: p.errorCode,
        connectId: p.connectId,
        requestId: p.requestId,
        diagnosticText: p.diagnosticText,
        i18nKey: p.i18nKey,
        oneKeyIdUserId,
      });

      const canLocalizeError =
        !(
          platformEnv.isNative &&
          getNativeStorageRecoveryToastTarget(p.title, p.message)
        ) &&
        p.i18nKey &&
        ((p.isHardwareError &&
          hasLoadedTranslation(intl.messages, p.i18nKey)) ||
          MAIN_THREAD_HARDWARE_ERROR_I18N_KEYS.has(p.i18nKey) ||
          (p.i18nKey === ETranslations.wallet_action_failed &&
            typeof p.i18nInfo?.message === 'string'));
      let title = canLocalizeError
        ? intl.formatMessage(
            { id: p.i18nKey, defaultMessage: p.title },
            p.i18nInfo,
          )
        : p.title || '';
      if (isPrimeUserBanned) title = 'OneKeyID';

      Toast[p.method]({
        title,
        message: isPrimeUserBanned
          ? intl.formatMessage(primeUserBannedMessage)
          : p.message,
        // icon is string in event bus (shared can't import IKeyOfIcons from components)
        icon: p.icon as any,
        toastId,
        actions,
        duration: p.duration,
        nativeStorageRecoveryTestSessionId:
          p.nativeStorageRecoveryTestSessionId,
      });
    };
    appEventBus.on(EAppEventBusNames.ShowToast, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, fn);
    };
  }, [intl, oneKeyIdUserId]);

  return null;
}
