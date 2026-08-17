import { BluetoothUnavailableWhileUsbConnectedError } from '@onekeyhq/shared/src/errors';

export function shouldContinueOnboardingDeviceScan(error: Error) {
  return error instanceof BluetoothUnavailableWhileUsbConnectedError;
}
