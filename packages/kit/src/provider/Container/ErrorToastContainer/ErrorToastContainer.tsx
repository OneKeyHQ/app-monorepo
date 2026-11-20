import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Toast, useClipboard } from '@onekeyhq/components';
import { closeOneKeyIdLoginDialogs } from '@onekeyhq/kit/src/components/OneKeyAuth/oneKeyIdLoginDialogs';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { PRIME_USER_BANNED_CODE } from '@onekeyhq/shared/src/prime/primeUserBanned';
import { subscribeNativeStorageContractViolations } from '@onekeyhq/shared/src/storage/nativeStorageContractViolationSubscription';
import {
  getNativeAppStorageEmergencyStatus,
  subscribeNativeAppStorageEmergencyStatus,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';
import { getNativeStorageRecoveryToastTarget } from '@onekeyhq/shared/src/storage/nativeStorageTypes';

import { useFirmwareUpdateActions } from '../../../views/FirmwareUpdate/hooks/useFirmwareUpdateActions';

import { shouldSuppressErrorToast, showErrorToast } from './ErrorToastListener';
import { getErrorAction } from './ErrorToasts';

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
  const bannedDialogVisible = useRef(false);
  // The toast actions are data, so the hooks their handlers need run here.
  const { copyText } = useClipboard();
  const { openChangeLogModal } = useFirmwareUpdateActions();
  const actionDeps = useRef({ copyText, openChangeLogModal });
  actionDeps.current = { copyText, openChangeLogModal };

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
      if (shouldSuppressErrorToast(p)) {
        return;
      }

      // A banned OneKey ID is signed out, so the notice is always a blocking
      // dialog rather than a toast with account actions.
      if (isPrimeUserBanned) {
        if (bannedDialogVisible.current) return;
        bannedDialogVisible.current = true;
        void (async () => {
          try {
            await closeOneKeyIdLoginDialogs();
            Dialog.show({
              title: intl.formatMessage({
                id: ETranslations.onekey_id_banned__title,
              }),
              description: intl.formatMessage({
                id: ETranslations.onekey_id_banned__desc,
              }),
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
                bannedDialogVisible.current = false;
              },
            });
          } catch {
            bannedDialogVisible.current = false;
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.onekey_id_banned__title,
              }),
              toastId: String(PRIME_USER_BANNED_CODE),
            });
          }
        })();
        return;
      }

      const actions = getErrorAction(
        {
          errorCode: p.errorCode,
          connectId: p.connectId,
          requestId: p.requestId,
          diagnosticText: p.diagnosticText,
          i18nKey: p.i18nKey,
        },
        {
          intl,
          copyText: (text) => actionDeps.current.copyText(text),
          openChangeLogModal: (params) =>
            actionDeps.current.openChangeLogModal(params),
        },
      );

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
      const title = canLocalizeError
        ? intl.formatMessage(
            { id: p.i18nKey, defaultMessage: p.title },
            p.i18nInfo,
          )
        : p.title;

      showErrorToast(p, { title, actions });
    };
    appEventBus.on(EAppEventBusNames.ShowToast, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, fn);
    };
  }, [intl]);

  return null;
}
