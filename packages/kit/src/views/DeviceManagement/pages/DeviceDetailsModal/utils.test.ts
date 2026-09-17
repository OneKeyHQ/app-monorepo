import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildDeviceDetailsVisibility,
  canOpenDeviceManagementDetails,
  canShowTrezorBleBinding,
  getFirmwareTypeChangeAvailability,
  getTrezorAutoLockOptionsMs,
  shouldShowDeviceInteractiveSections,
  syncRelevantDeviceStateEvent,
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

  it('shows Passphrase settings for OneKey devices, including Pro2', () => {
    expect(
      buildDeviceDetailsVisibility({
        vendor: EHardwareVendor.onekey,
        isQrWallet: false,
        hasLoadedDevice: true,
      }),
    ).toMatchObject({
      showDeviceSettings: true,
      showPassphraseSettings: true,
    });
  });

  it.each([EDeviceType.Pro, EDeviceType.Classic1s, EDeviceType.ClassicPure])(
    'enables firmware type switching for %s',
    (deviceType) => {
      expect(getFirmwareTypeChangeAvailability(deviceType)).toBe('enabled');
    },
  );

  it.each([EDeviceType.Pro2, EDeviceType.Neo])(
    'hides firmware type switching for unsupported Protocol V2 device %s',
    (deviceType) => {
      expect(getFirmwareTypeChangeAvailability(deviceType)).toBe('hidden');
    },
  );

  it.each([
    EDeviceType.Classic,
    EDeviceType.Mini,
    EDeviceType.Touch,
    EDeviceType.Unknown,
  ])('hides firmware type switching for %s', (deviceType) => {
    expect(getFirmwareTypeChangeAvailability(deviceType)).toBe('hidden');
  });

  it('shows Pro2 interactive settings consistently with Pro devices', () => {
    expect(shouldShowDeviceInteractiveSections(EDeviceType.Pro2, false)).toBe(
      true,
    );
    expect(shouldShowDeviceInteractiveSections(EDeviceType.Pro2, true)).toBe(
      true,
    );
    expect(
      shouldShowDeviceInteractiveSections(EDeviceType.Classic1s, false),
    ).toBe(true);
  });

  it('does not refresh details for an unrelated device state event', async () => {
    const refresh = jest.fn();

    await expect(
      syncRelevantDeviceStateEvent({
        event: { connectId: 'OTHER' },
        applyEvent: jest.fn().mockResolvedValue(false),
        refresh,
      }),
    ).resolves.toBe(false);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes details after applying a relevant device state event', async () => {
    const refresh = jest.fn().mockResolvedValue(undefined);

    await expect(
      syncRelevantDeviceStateEvent({
        event: { connectId: 'CURRENT' },
        applyEvent: jest.fn().mockResolvedValue(true),
        refresh,
      }),
    ).resolves.toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
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
