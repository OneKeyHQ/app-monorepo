import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import {
  ORPHAN_ELIGIBLE_ERROR_CODES,
  HardwareErrorCode as ThirdPartyHwErrorCode,
} from '@onekeyfe/hwk-adapter-core/errors';

import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  isHardwareErrorByCode,
  isHardwareInterruptErrorByCode,
  isOneKeyHardwareError,
} from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';

// Share this policy with outer import loops so they cannot swallow a batch
// abort and prompt for the same password or device again on the next item.
export function shouldAbortAccountCreation(error: unknown): boolean {
  if (
    errorUtils.isErrorByClassName({
      error,
      className: [
        EOneKeyErrorClassNames.PrimeTransferImportCancelledError,
        EOneKeyErrorClassNames.OneKeyAbortError,
        EOneKeyErrorClassNames.PasswordPromptDialogCancel,
        EOneKeyErrorClassNames.SecureQRCodeDialogCancel,
        EOneKeyErrorClassNames.OneKeyErrorScanQrCodeCancel,
        EOneKeyErrorClassNames.HardwareUserCancelFromOutside,
        EOneKeyErrorClassNames.IncorrectPassword,
        EOneKeyErrorClassNames.IncorrectPinError,
        EOneKeyErrorClassNames.IncorrectMasterPassword,
        EOneKeyErrorClassNames.WrongPassword,
        EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
        EOneKeyErrorClassNames.LocalDbOpenError,
      ],
    })
  ) {
    return true;
  }

  // Authorization protection can deliberately mask the error class. Preserve
  // that generic error and stop instead of retrying authentication per item.
  if (
    errorUtils.isErrorByClassName({
      error,
      className: EOneKeyErrorClassNames.OneKeyLocalError,
    }) &&
    (error as { message?: unknown })?.message === 'Unknown error'
  ) {
    return true;
  }
  if (!isOneKeyHardwareError(error)) {
    return false;
  }
  const hardwareError = error;
  if (
    isHardwareInterruptErrorByCode({ error: hardwareError }) ||
    isHardwareErrorByCode({
      error: hardwareError,
      code: ORPHAN_ELIGIBLE_ERROR_CODES,
    })
  ) {
    return true;
  }
  // Only an explicitly unsupported chain/method/path is local to one account.
  // Unknown device, transport, permission and authentication failures must not
  // restart the same interaction for every remaining network.
  return !isHardwareErrorByCode({
    error: hardwareError,
    code: [
      HardwareErrorCode.DeviceNotSupportMethod,
      HardwareErrorCode.ForbiddenKeyPath,
      ThirdPartyHwErrorCode.MethodNotSupported,
      ThirdPartyHwErrorCode.ChainNotSupported,
      ThirdPartyHwErrorCode.DevicePathForbidden,
    ],
  });
}
