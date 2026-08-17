import { BluetoothUnavailableWhileUsbConnectedError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareError } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';

export function isOnboardingHardwareError(
  error: unknown,
): error is IOneKeyError {
  return Boolean(isHardwareError({ error: error as IOneKeyError | undefined }));
}

export function shouldContinueOnboardingDeviceScan(error: Error) {
  return error instanceof BluetoothUnavailableWhileUsbConnectedError;
}
