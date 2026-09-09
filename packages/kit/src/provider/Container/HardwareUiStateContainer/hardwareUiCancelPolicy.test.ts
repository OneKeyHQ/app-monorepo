import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import { shouldSkipHardwareDeviceCancel } from './hardwareUiCancelPolicy';

describe('shouldSkipHardwareDeviceCancel', () => {
  it('sends cancel for device prompts regardless of device type', () => {
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_PIN,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(false);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_BUTTON,
        deviceType: EDeviceType.Classic,
      }),
    ).toBe(false);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_PIN,
        deviceType: EDeviceType.Pro,
      }),
    ).toBe(false);
  });

  it('lets the SDK decide cancel during pairing or permission UI', () => {
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.DeviceChecking,
        eventType: EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(false);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.BLUETOOTH_PERMISSION,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(false);
  });

  it('still skips cancel for firmware workflow and SDK pin-window close', () => {
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.FIRMWARE_PROGRESS,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(true);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.CLOSE_UI_PIN_WINDOW,
      }),
    ).toBe(true);
  });
});
