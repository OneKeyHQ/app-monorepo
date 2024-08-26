import { isPlainObject } from 'lodash';

import { EAppEventBusNames, appEventBus } from '../../eventBus/appEventBus';
import { EOneKeyErrorClassNames, type IOneKeyError } from '../types/errorTypes';

let lastToastErrorInstance: IOneKeyError | undefined;
function showToastOfError(error: IOneKeyError | unknown | undefined) {
  const err = error as IOneKeyError | undefined;
  if (
    err?.className &&
    [
      EOneKeyErrorClassNames.PasswordPromptDialogCancel,
      EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
      EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
      EOneKeyErrorClassNames.FirmwareUpdateExit,
      EOneKeyErrorClassNames.FirmwareUpdateTasksClear,
      EOneKeyErrorClassNames.OneKeyErrorAirGapAccountNotFound,
    ].includes(err?.className)
  ) {
    return;
  }
  const isTriggered = err?.$$autoToastErrorTriggered;
  const isSameError = lastToastErrorInstance === err;
  // TODO log error to file if developer mode on
  if (err && err?.autoToast && !isTriggered && !isSameError) {
    err.$$autoToastErrorTriggered = true;
    lastToastErrorInstance = err;
    appEventBus.emit(EAppEventBusNames.ShowToast, {
      errorCode: err?.code,
      method: 'error',
      title: err?.message ?? 'Error',
      message: err?.requestId,
    });
  }
}

function toastIfError(error: unknown) {
  // Some third-party libraries or external wallets return not an Error object, but a normal JSON object. Here we need to use isPlainObject to do a compatible processing.

  if (error instanceof Error || isPlainObject(error)) {
    const e = error as IOneKeyError | undefined;
    if (e) {
      // handle autoToast error by BackgroundApiProxyBase
      e.autoToast = true;
    }
  }
}

function toastIfErrorDisable(error: unknown) {
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
