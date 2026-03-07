import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import axios from 'axios';
import { isPlainObject } from 'lodash';

import type { ETranslations } from '@onekeyhq/shared/src/locale';

import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import { getInstanceId } from '../../modules3rdParty/intercom/utils';
import { EOneKeyErrorClassNames, type IOneKeyError } from '../types/errorTypes';

async function buildDiagnosticText(err: IOneKeyError): Promise<string> {
  const parts: string[] = [];

  // Add request URL if available (from axios interceptor error data)
  const requestUrl = (err?.data as { requestUrl?: string } | undefined)
    ?.requestUrl;
  if (requestUrl) {
    parts.push(`URL: ${requestUrl}`);
  }

  if (err?.requestId) {
    parts.push(`RequestId: ${err.requestId}`);

    // Add instanceId when requestId is present
    try {
      const instanceId = await getInstanceId();
      if (instanceId) {
        parts.push(`InstanceId: ${instanceId}`);
      }
    } catch (error) {
      console.warn('[buildDiagnosticText] Failed to get instanceId:', error);
    }
  }
  if (err?.code) {
    parts.push(`Error Code: ${err.code}`);
  }
  if (err?.message) {
    parts.push(`Message: ${err.message}`);
  }
  parts.push(`Timestamp: ${new Date().toISOString()}`);

  return parts.join('\n');
}

function fixAxiosAbortCancelError(error: unknown) {
  if (error && axios.isCancel(error)) {
    (error as IOneKeyError).className =
      (error as IOneKeyError).className ||
      EOneKeyErrorClassNames.AxiosAbortCancelError;
  }
}

let lastToastErrorInstance: IOneKeyError | undefined;
let lastToastErrorCode: number | string | undefined;
let lastToastTimestamp = 0;
const TOAST_DEDUPLICATE_WINDOW_MS = 5000;
function showToastOfError(error: IOneKeyError | unknown | undefined) {
  fixAxiosAbortCancelError(error);
  const err = error as IOneKeyError | undefined;
  if (
    err?.className &&
    [
      // ignore auto toast errors
      EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
      EOneKeyErrorClassNames.PrimeLoginDialogCancelError,
      EOneKeyErrorClassNames.OAuthLoginCancelError,
      EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
      EOneKeyErrorClassNames.PasswordPromptDialogCancel,
      EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
      EOneKeyErrorClassNames.FirmwareUpdateExit,
      EOneKeyErrorClassNames.FirmwareUpdateTasksClear,
      EOneKeyErrorClassNames.WebDeviceNotFoundOrNeedsPermission,
      EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound,
      EOneKeyErrorClassNames.OneKeyErrorAirGapStandardWalletRequiredWhenCreateHiddenWallet,
      EOneKeyErrorClassNames.AxiosAbortCancelError,
      // use Dialog instead of Toast, check GlobalErrorHandlerContainer
      EOneKeyErrorClassNames.DeviceNotOpenedPassphrase,
      EOneKeyErrorClassNames.DeviceNotFound,
      // IncorrectPinError is handled inline in VerifyPinPage
      EOneKeyErrorClassNames.IncorrectPinError,
    ].includes(err?.className)
  ) {
    return;
  }
  // Ignore DefectiveFirmware errors - use Dialog instead of Toast
  if (err?.code === HardwareErrorCode.DefectiveFirmware) {
    return;
  }
  let shouldMuteToast = false;
  if (
    err?.className === EOneKeyErrorClassNames.OneKeyServerApiError &&
    !err?.message
  ) {
    shouldMuteToast = true;
  }
  const isTriggered = err?.$$autoToastErrorTriggered;
  const isSameError = lastToastErrorInstance === err;
  // Deduplicate by errorCode within a time window — collapse parallel requests
  // hitting the same error, but allow legitimate recurring errors after the window expires
  const isSameErrorCode =
    err?.code !== undefined &&
    err?.code === lastToastErrorCode &&
    Date.now() - lastToastTimestamp < TOAST_DEDUPLICATE_WINDOW_MS;
  // TODO log error to file if developer mode on
  if (
    err &&
    err?.autoToast &&
    !isTriggered &&
    !isSameError &&
    !isSameErrorCode &&
    !shouldMuteToast
  ) {
    err.$$autoToastErrorTriggered = true;
    lastToastErrorInstance = err;
    lastToastErrorCode = err?.code;
    lastToastTimestamp = Date.now();
    void (async () => {
      const diagnosticText = await buildDiagnosticText(err);

      let httpStatusCode: number | undefined = err.httpStatusCode;

      if (!httpStatusCode) {
        const errorWithResponse = err as
          | (IOneKeyError & {
              response?: {
                status?: unknown;
              };
            })
          | undefined;

        if (
          errorWithResponse?.response &&
          typeof errorWithResponse.response.status === 'number'
        ) {
          httpStatusCode = errorWithResponse.response.status;
        }
      }

      appEventBus.emit(EAppEventBusNames.ShowToast, {
        errorCode: err?.code,
        httpStatusCode,
        method: 'error' as const,
        title: err?.message ?? 'Error',
        requestId: err?.requestId,
        diagnosticText,
        i18nKey: err?.key as ETranslations | undefined,
      });
    })();
  }
}

function toastIfError(error: unknown) {
  fixAxiosAbortCancelError(error);
  // Some third-party libraries or external wallets return not an Error object, but a normal JSON object. Here we need to use isPlainObject to do a compatible processing.

  if (error instanceof Error || isPlainObject(error)) {
    const e = error as IOneKeyError | undefined;

    if (e) {
      // handle autoToast error by BackgroundApiProxyBase
      // Respect explicit autoToast set by error creator (e.g. 5xx interceptor)
      if (typeof e.autoToast !== 'boolean') {
        e.autoToast = true;
      }
    }
  }
}

function toastIfErrorDisable(error: unknown) {
  fixAxiosAbortCancelError(error);
  // Some third-party libraries or external wallets return not an Error object, but a normal JSON object. Here we need to use isPlainObject to do a compatible processing.

  if (error instanceof Error || isPlainObject(error)) {
    const e = error as IOneKeyError | undefined;
    if (e) {
      e.autoToast = false;
    }
  }
}

async function withErrorAutoToast<T>(
  fn: () => Promise<T>,
  options: {
    alwaysShowToast?: boolean;
  } = {},
) {
  try {
    const result = await fn();
    return result;
  } catch (error: unknown) {
    fixAxiosAbortCancelError(error);
    const alwaysShowToast = options?.alwaysShowToast ?? true;
    if (alwaysShowToast) {
      toastIfError(error);
    }
    showToastOfError(error);
    throw error;
  }
}

export default {
  toastIfError,
  toastIfErrorDisable,
  showToastOfError,
  withErrorAutoToast,
};
