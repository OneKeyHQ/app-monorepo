import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareUiStateAction } from '@onekeyhq/shared/types/hardwareUi';

import { shouldSkipHardwareDeviceCancel } from './hardwareUiCancelPolicy';

describe('shouldSkipHardwareDeviceCancel', () => {
  it('sends cancel for Pro2 pin / confirm prompts', () => {
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_PIN,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(false);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_BUTTON,
        deviceType: EDeviceType.Neo,
      }),
    ).toBe(false);
  });

  it('skips cancel for Classic and Pro1', () => {
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_BUTTON,
        deviceType: EDeviceType.Classic,
      }),
    ).toBe(true);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_PIN,
        deviceType: EDeviceType.Pro,
      }),
    ).toBe(true);
  });

  it('skips cancel during Bluetooth pairing or permission UI', () => {
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.DeviceChecking,
        eventType: EHardwareUiStateAction.BLUETOOTH_DEVICE_PAIRING,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(true);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.BLUETOOTH_PERMISSION,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(true);
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.DeviceChecking,
        eventType: EHardwareUiStateAction.BLUETOOTH_POWERED_OFF,
        deviceType: EDeviceType.Pro2,
      }),
    ).toBe(true);
  });

  it('still allows cancel when the device type is not known yet', () => {
    expect(
      shouldSkipHardwareDeviceCancel({
        action: EHardwareUiStateAction.REQUEST_BUTTON,
      }),
    ).toBe(false);
  });
});
