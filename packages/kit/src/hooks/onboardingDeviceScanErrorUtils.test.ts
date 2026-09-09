import { BluetoothUnavailableWhileUsbConnectedError } from '@onekeyhq/shared/src/errors';

import { shouldContinueOnboardingDeviceScan } from './onboardingDeviceScanErrorUtils';

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
