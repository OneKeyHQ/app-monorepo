import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { isTrezorHardwareErrorDialogPayload } from './hardwareErrorDialogUtils';

describe('hardwareErrorDialogUtils', () => {
  it('detects Trezor from the event vendor field', () => {
    expect(
      isTrezorHardwareErrorDialogPayload({
        errorType: 'DeviceNotFound',
        vendor: EHardwareVendor.trezor,
      }),
    ).toBe(true);
  });

  it('keeps OneKey and missing vendors on the default dialog', () => {
    expect(
      isTrezorHardwareErrorDialogPayload({
        errorType: 'DeviceNotFound',
        vendor: EHardwareVendor.onekey,
      }),
    ).toBe(false);

    expect(
      isTrezorHardwareErrorDialogPayload({
        errorType: 'DeviceNotFound',
      }),
    ).toBe(false);
  });
});
