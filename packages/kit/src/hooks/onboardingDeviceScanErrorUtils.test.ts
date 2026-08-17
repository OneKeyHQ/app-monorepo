import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import {
  BluetoothUnavailableWhileUsbConnectedError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';

import {
  isOnboardingHardwareError,
  shouldContinueOnboardingDeviceScan,
} from './onboardingDeviceScanErrorUtils';

describe('isOnboardingHardwareError', () => {
  it('recognizes hardware error metadata rehydrated across native runtimes', () => {
    const error = Object.assign(new OneKeyLocalError('link disabled'), {
      className: EOneKeyErrorClassNames.OneKeyHardwareError,
      code: HardwareErrorCode.BleUnavailableWhileUsbConnected,
    });

    expect(isOnboardingHardwareError(error)).toBe(true);
  });
});

describe('shouldContinueOnboardingDeviceScan', () => {
  it('keeps polling while USB temporarily blocks desktop Bluetooth', () => {
    expect(
      shouldContinueOnboardingDeviceScan(
        new BluetoothUnavailableWhileUsbConnectedError(),
      ),
    ).toBe(true);
  });

  it('stops polling for terminal scan failures', () => {
    expect(
      shouldContinueOnboardingDeviceScan(new Error('transport unavailable')),
    ).toBe(false);
  });
});
