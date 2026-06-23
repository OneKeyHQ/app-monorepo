import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildDeviceDetailsVisibility,
  canOpenDeviceManagementDetails,
  canShowTrezorBleBinding,
  getTrezorAutoLockOptionsMs,
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

  it('shows Trezor BLE binding on BLE capable models, including re-binding when already bound', () => {
    expect(
      canShowTrezorBleBinding(
        {
          vendor: EHardwareVendor.trezor,
          connectId: 'USB_ID',
          deviceId: 'FEATURES_DEVICE_ID',
          settings: {
            vendorModel: 'T3W1',
            vendorModelName: 'Safe 7',
          },
        },
        { isDesktop: true },
      ),
    ).toBe(true);

    // Already bound: still shown so a stale BLE connectId can be re-picked.
    expect(
      canShowTrezorBleBinding(
        {
          vendor: EHardwareVendor.trezor,
          connectId: 'USB_ID',
          deviceId: 'FEATURES_DEVICE_ID',
          bleConnectId: 'BLE_ID',
          settings: {
            vendorModel: 'T3W1',
          },
        },
        { isDesktop: true },
      ),
    ).toBe(true);

    expect(
      canShowTrezorBleBinding(
        {
          vendor: EHardwareVendor.trezor,
          connectId: 'USB_ID',
          deviceId: 'FEATURES_DEVICE_ID',
          settings: {
            vendorModel: 'Safe 5',
            vendorModelName: 'Safe 5',
          },
        },
        { isDesktop: true },
      ),
    ).toBe(false);

    expect(
      canShowTrezorBleBinding(
        {
          vendor: EHardwareVendor.trezor,
          connectId: 'USB_ID',
          deviceId: 'FEATURES_DEVICE_ID',
          settings: {
            vendorModel: 'T3W1',
            vendorModelName: 'Safe 7',
          },
        },
        { isDesktop: false },
      ),
    ).toBe(false);
  });

  it('uses Trezor Suite compatible auto-lock values', () => {
    expect(getTrezorAutoLockOptionsMs()).toEqual([
      60_000, 300_000, 600_000, 1_200_000, 1_800_000, 3_600_000, 86_400_000,
      518_400_000,
    ]);
    expect(
      getTrezorAutoLockOptionsMs().every(
        (value) => value >= 60_000 && value <= 518_400_000,
      ),
    ).toBe(true);
  });
});
