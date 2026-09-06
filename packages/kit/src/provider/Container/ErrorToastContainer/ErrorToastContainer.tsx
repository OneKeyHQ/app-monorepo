import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Toast, globalNetInfo } from '@onekeyhq/components';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { subscribeNativeStorageContractViolations } from '@onekeyhq/shared/src/storage/nativeStorageContractViolationSubscription';

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

// These errors may cross from a runtime without loaded locale messages.
const MAIN_THREAD_HARDWARE_ERROR_I18N_KEYS = new Set<ETranslations>([
  ETranslations.hardware_device_information_is_inconsistent_it_may_be_caused_by_device_reset,
  ETranslations.hardware_device_passphrase_state_error,
  ETranslations.hardware_device_pin_state_error,
  ETranslations.update_update_in_official_web_tool_desc_copy,
]);

export function ErrorToastContainer() {
  const intl = useIntl();

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
      if (!p.title) {
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

      const deduplication = getDeduplicationId(statusCodeForDeduplicate);
      // For critical errors (403, 429, 5xx), force deduplication to prevent toast spam
      // Otherwise, respect custom toastId from caller
      const toastId = deduplication.forceDeduplicate
        ? deduplication.id
        : p.toastId ||
          deduplication.id ||
          (p.errorCode !== undefined ? String(p.errorCode) : undefined) ||
          p.title ||
          p.requestId;

      const actions = getErrorAction({
        errorCode: p.errorCode,
        connectId: p.connectId,
        requestId: p.requestId,
        diagnosticText: p.diagnosticText,
        i18nKey: p.i18nKey,
      });

      const canLocalizeError =
        p.i18nKey &&
        (MAIN_THREAD_HARDWARE_ERROR_I18N_KEYS.has(p.i18nKey) ||
          (p.i18nKey === ETranslations.wallet_action_failed &&
            typeof p.i18nInfo?.message === 'string'));
      const title = canLocalizeError
        ? intl.formatMessage(
            { id: p.i18nKey, defaultMessage: p.title },
            p.i18nInfo,
          )
        : p.title;

      Toast[p.method]({
        title,
        message: p.message,
        // icon is string in event bus (shared can't import IKeyOfIcons from components)
        icon: p.icon as any,
        toastId,
        actions,
        duration: p.duration,
      });
    };
    appEventBus.on(EAppEventBusNames.ShowToast, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.ShowToast, fn);
    };
  }, [intl]);

  return null;
}
