import { EHardwareTransportType } from '@onekeyhq/shared/types';

import { resolveHwWalletTransportType } from './resolveHwWalletTransportType';

describe('resolveHwWalletTransportType', () => {
  // The bug: desktop fused scan surfaces a BLE device while the global default
  // is USB → must be corrected to a BLE transport so bleConnectId gets filled.
  it('corrects a BLE device under a USB default to DesktopWebBle (desktop)', () => {
    expect(
      resolveHwWalletTransportType({
        globalTransportType: EHardwareTransportType.WEBUSB,
        deviceConnectionType: 'ble',
        isNative: false,
      }),
    ).toBe(EHardwareTransportType.DesktopWebBle);
    expect(
      resolveHwWalletTransportType({
        globalTransportType: EHardwareTransportType.Bridge,
        deviceConnectionType: 'ble',
        isNative: false,
      }),
    ).toBe(EHardwareTransportType.DesktopWebBle);
  });

  it('corrects a BLE device under a USB default to BLE (native)', () => {
    expect(
      resolveHwWalletTransportType({
        globalTransportType: EHardwareTransportType.WEBUSB,
        deviceConnectionType: 'ble',
        isNative: true,
      }),
    ).toBe(EHardwareTransportType.BLE);
  });

  it('leaves USB devices on the USB-family global value', () => {
    expect(
      resolveHwWalletTransportType({
        globalTransportType: EHardwareTransportType.WEBUSB,
        deviceConnectionType: 'usb',
        isNative: false,
      }),
    ).toBe(EHardwareTransportType.WEBUSB);
    expect(
      resolveHwWalletTransportType({
        globalTransportType: EHardwareTransportType.Bridge,
        deviceConnectionType: 'usb',
        isNative: false,
      }),
    ).toBe(EHardwareTransportType.Bridge);
  });

  it('leaves a BLE device under a BLE default unchanged', () => {
    expect(
      resolveHwWalletTransportType({
        globalTransportType: EHardwareTransportType.BLE,
        deviceConnectionType: 'ble',
        isNative: true,
      }),
    ).toBe(EHardwareTransportType.BLE);
    expect(
      resolveHwWalletTransportType({
        globalTransportType: EHardwareTransportType.DesktopWebBle,
        deviceConnectionType: 'ble',
        isNative: false,
      }),
    ).toBe(EHardwareTransportType.DesktopWebBle);
  });

  it('is a no-op when connectionType is unknown (OneKey HD / Ledger)', () => {
    // OneKey HD devices carry no connectionType → global value is preserved.
    for (const global of [
      EHardwareTransportType.WEBUSB,
      EHardwareTransportType.Bridge,
      EHardwareTransportType.BLE,
      EHardwareTransportType.DesktopWebBle,
    ]) {
      expect(
        resolveHwWalletTransportType({
          globalTransportType: global,
          deviceConnectionType: undefined,
          isNative: false,
        }),
      ).toBe(global);
    }
  });
});
