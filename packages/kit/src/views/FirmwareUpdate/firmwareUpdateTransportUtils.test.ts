import { EHardwareTransportType } from '@onekeyhq/shared/types';

import {
  isBluetoothFirmwareUpdateTransport,
  shouldKeepDesktopBleForFirmwareUpdate,
} from './firmwareUpdateTransportUtils';

describe('shouldKeepDesktopBleForFirmwareUpdate', () => {
  it('keeps the explicitly forced desktop BLE transport', () => {
    expect(
      shouldKeepDesktopBleForFirmwareUpdate({
        forceTransportType: EHardwareTransportType.DesktopWebBle,
        currentTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).toBe(true);
  });

  it('keeps the active desktop BLE transport when no transport is forced', () => {
    expect(
      shouldKeepDesktopBleForFirmwareUpdate({
        forceTransportType: undefined,
        currentTransportType: EHardwareTransportType.DesktopWebBle,
      }),
    ).toBe(true);
  });

  it('continues to prepare USB for USB transports', () => {
    expect(
      shouldKeepDesktopBleForFirmwareUpdate({
        forceTransportType: undefined,
        currentTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).toBe(false);
  });
});

describe('isBluetoothFirmwareUpdateTransport', () => {
  it('treats native transport as Bluetooth', () => {
    expect(
      isBluetoothFirmwareUpdateTransport({
        isNative: true,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).toBe(true);
  });

  it('treats desktop Web BLE as Bluetooth', () => {
    expect(
      isBluetoothFirmwareUpdateTransport({
        isNative: false,
        hardwareTransportType: EHardwareTransportType.DesktopWebBle,
      }),
    ).toBe(true);
  });

  it('keeps desktop USB transports on the USB checklist', () => {
    expect(
      isBluetoothFirmwareUpdateTransport({
        isNative: false,
        hardwareTransportType: EHardwareTransportType.WEBUSB,
      }),
    ).toBe(false);
  });
});
