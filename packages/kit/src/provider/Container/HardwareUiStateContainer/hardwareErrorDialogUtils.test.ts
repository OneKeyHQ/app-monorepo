import { HARDWARE_ERROR_DIALOG_TYPES } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  isTrezorHardwareErrorDialogPayload,
  shouldReplaceHardwareErrorDialog,
} from './hardwareErrorDialogUtils';

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

  it('prioritizes Bluetooth re-pairing guidance over another hardware error', () => {
    expect(
      shouldReplaceHardwareErrorDialog({
        currentErrorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
        nextErrorType: HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR,
      }),
    ).toBe(true);

    expect(
      shouldReplaceHardwareErrorDialog({
        currentErrorType: HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR,
        nextErrorType: HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR,
      }),
    ).toBe(false);

    expect(
      shouldReplaceHardwareErrorDialog({
        currentErrorType: HARDWARE_ERROR_DIALOG_TYPES.BLE_DEVICE_BOND_ERROR,
        nextErrorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
      }),
    ).toBe(false);
  });
});
