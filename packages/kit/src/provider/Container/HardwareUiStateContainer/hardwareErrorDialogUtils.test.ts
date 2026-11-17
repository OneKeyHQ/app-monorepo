import { HARDWARE_ERROR_DIALOG_TYPES } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  createHardwareErrorDialogEventHandler,
  isTrezorHardwareErrorDialogPayload,
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

  it('does not deliver a trailing device-not-found error', () => {
    jest.useFakeTimers();
    const deliveredErrors: string[] = [];
    const eventHandler = createHardwareErrorDialogEventHandler(
      ({ errorType }) => {
        deliveredErrors.push(errorType);
      },
      2500,
    );
    try {
      eventHandler({
        errorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
      });
      eventHandler({
        errorType: HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
      });

      expect(deliveredErrors).toEqual([
        HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
      ]);

      jest.advanceTimersByTime(2500);

      expect(deliveredErrors).toEqual([
        HARDWARE_ERROR_DIALOG_TYPES.DEVICE_NOT_FOUND,
      ]);
    } finally {
      eventHandler.cancel();
      jest.useRealTimers();
    }
  });
});
