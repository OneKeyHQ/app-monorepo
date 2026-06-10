import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildDeviceDetailsVisibility,
  canOpenDeviceManagementDetails,
  canShowTrezorBleBinding,
} from './utils';

describe('DeviceDetailsModal utils', () => {
  it('allows Ledger rows to open device details', () => {
    expect(canOpenDeviceManagementDetails(EHardwareVendor.ledger)).toBe(true);
  });

  it('allows Trezor rows to open device details', () => {
    expect(canOpenDeviceManagementDetails(EHardwareVendor.trezor)).toBe(true);
  });

  it('shows only supported Trezor device management sections', () => {
    expect(
      buildDeviceDetailsVisibility({
        vendor: EHardwareVendor.trezor,
        isQrWallet: false,
        hasLoadedDevice: true,
      }),
    ).toMatchObject({
      showDeviceSupport: false,
      showFirmwareActions: false,
      showDeviceSettings: true,
      showPassphraseSettings: true,
      showDeviceConnection: true,
    });
  });

  it('does not show device settings for Ledger device management details', () => {
    expect(
      buildDeviceDetailsVisibility({
        vendor: EHardwareVendor.ledger,
        isQrWallet: false,
        hasLoadedDevice: true,
      }),
    ).toMatchObject({
      showDeviceSettings: false,
      showPassphraseSettings: false,
      showDeviceConnection: true,
    });
  });

  it('shows Trezor BLE binding only before a BLE connectId is bound on BLE capable models', () => {
    expect(
      canShowTrezorBleBinding({
        vendor: EHardwareVendor.trezor,
        connectId: 'USB_ID',
        deviceId: 'FEATURES_DEVICE_ID',
        settings: {
          vendorModel: 'T3W1',
          vendorModelName: 'Safe 7',
        },
      }),
    ).toBe(true);

    expect(
      canShowTrezorBleBinding({
        vendor: EHardwareVendor.trezor,
        connectId: 'USB_ID',
        deviceId: 'FEATURES_DEVICE_ID',
        bleConnectId: 'BLE_ID',
        settings: {
          vendorModel: 'T3W1',
        },
      }),
    ).toBe(false);

    expect(
      canShowTrezorBleBinding({
        vendor: EHardwareVendor.trezor,
        connectId: 'USB_ID',
        deviceId: 'FEATURES_DEVICE_ID',
        settings: {
          vendorModel: 'Safe 5',
          vendorModelName: 'Safe 5',
        },
      }),
    ).toBe(false);
  });
});
