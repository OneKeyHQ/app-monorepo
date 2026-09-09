import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
  buildHardwareConnectedDeviceKeys,
  getWalletHardwareConnectionKeys,
  getWebUsbConnectedDeviceKey,
  isSupportedHardwareWebUsbDevice,
  isWalletConnectedByHardwareStatus,
} from './useHardwareWalletConnectStatusUtils';

const usbDevice = ({
  vendorId,
  productId,
  serialNumber,
}: {
  vendorId: number;
  productId: number;
  serialNumber?: string;
}) =>
  ({
    vendorId,
    productId,
    serialNumber,
  }) as USBDevice;

describe('hardware wallet connect status utils', () => {
  it('detects supported WebUSB devices by combined filters', () => {
    const oneKeyFilter = ONEKEY_WEBUSB_FILTER.find(
      (filter) => filter.vendorId && filter.productId,
    );
    expect(oneKeyFilter).toBeTruthy();

    expect(
      isSupportedHardwareWebUsbDevice(
        usbDevice({
          vendorId: oneKeyFilter?.vendorId ?? 0,
          productId: oneKeyFilter?.productId ?? 0,
        }),
      ),
    ).toBe(true);

    const trezorUsbDevice = usbDevice({
      vendorId: TREZOR_WEBUSB_FILTERS[0].vendorId ?? 0,
      productId: TREZOR_WEBUSB_FILTERS[0].productId ?? 0,
      serialNumber: 'trezor-usb-serial',
    });
    expect(isSupportedHardwareWebUsbDevice(trezorUsbDevice)).toBe(true);
    expect(getWebUsbConnectedDeviceKey(trezorUsbDevice)).toBe(
      'trezor-usb-serial',
    );
  });

  it('matches Trezor wallets by transport connect ids', () => {
    const wallet = {
      associatedDeviceInfo: {
        vendor: EHardwareVendor.trezor,
        deviceId: 'trezor-features-device-id',
        connectId: 'usb-serial',
        usbConnectId: 'usb-serial',
        bleConnectId: 'ble-id',
      },
    };

    expect(getWalletHardwareConnectionKeys(wallet)).toEqual([
      'usb-serial',
      'ble-id',
    ]);
    expect(
      isWalletConnectedByHardwareStatus({
        wallet,
        connectedDeviceKeys: new Set(['usb-serial']),
      }),
    ).toBe(true);
  });

  it('keeps OneKey wallets matched by features device id', () => {
    const wallet = {
      associatedDeviceInfo: {
        vendor: EHardwareVendor.onekey,
        deviceId: 'onekey-device-id',
        connectId: 'onekey-connect-id',
      },
    };

    expect(getWalletHardwareConnectionKeys(wallet)).toEqual([
      'onekey-device-id',
      'onekey-connect-id',
    ]);
    expect(
      isWalletConnectedByHardwareStatus({
        wallet,
        connectedDeviceKeys: new Set(['onekey-device-id']),
      }),
    ).toBe(true);
  });

  it('matches OneKey Pro 2 wallets by the USB serial identity', () => {
    const wallet = {
      associatedDeviceInfo: {
        vendor: EHardwareVendor.onekey,
        deviceId: 'pro2-wallet-device-id',
        uuid: 'pro2-serial-number',
        connectId: 'pro2-serial-number',
        usbConnectId: 'pro2-serial-number',
      },
    };

    expect(getWalletHardwareConnectionKeys(wallet)).toEqual([
      'pro2-wallet-device-id',
      'pro2-serial-number',
    ]);
    expect(
      isWalletConnectedByHardwareStatus({
        wallet,
        connectedDeviceKeys: new Set(['pro2-serial-number']),
      }),
    ).toBe(true);
  });

  it('matches a reset OneKey wallet by the connected SDK identity', () => {
    const connectedDeviceKeys = buildHardwareConnectedDeviceKeys({
      backgroundIdentityKeys: [
        'stable-device-serial',
        'reset-features-device-id',
      ],
      webUsbDevices: [
        usbDevice({
          vendorId: ONEKEY_WEBUSB_FILTER[0].vendorId ?? 0,
          productId: ONEKEY_WEBUSB_FILTER[0].productId ?? 0,
          serialNumber: 'pre-reset-usb-serial',
        }),
      ],
    });
    const resetWallet = {
      associatedDeviceInfo: {
        vendor: EHardwareVendor.onekey,
        deviceId: 'reset-features-device-id',
        connectId: 'stable-device-serial',
      },
    };
    const otherWallet = {
      associatedDeviceInfo: {
        vendor: EHardwareVendor.onekey,
        deviceId: 'other-device-id',
        connectId: 'other-device-serial',
      },
    };

    expect(
      isWalletConnectedByHardwareStatus({
        wallet: resetWallet,
        connectedDeviceKeys,
      }),
    ).toBe(true);
    expect(
      isWalletConnectedByHardwareStatus({
        wallet: otherWallet,
        connectedDeviceKeys,
      }),
    ).toBe(false);
  });

  it('does not mark hidden wallets connected', () => {
    expect(
      isWalletConnectedByHardwareStatus({
        wallet: {
          passphraseState: 'hidden',
          associatedDeviceInfo: {
            vendor: EHardwareVendor.trezor,
            connectId: 'usb-serial',
          },
        },
        connectedDeviceKeys: new Set(['usb-serial']),
      }),
    ).toBe(false);
  });

  it('does not mark deprecated wallets connected through the shared device serial', () => {
    const associatedDeviceInfo = {
      deviceId: 'old-seed',
      uuid: 'SERIAL',
      connectId: 'BLE-ID',
    };
    expect(
      isWalletConnectedByHardwareStatus({
        wallet: { deprecated: true, associatedDeviceInfo },
        connectedDeviceKeys: new Set(['SERIAL', 'BLE-ID']),
      }),
    ).toBe(false);
    expect(
      isWalletConnectedByHardwareStatus({
        wallet: { deprecated: false, associatedDeviceInfo },
        connectedDeviceKeys: new Set(['SERIAL']),
      }),
    ).toBe(true);
  });

  it('matches the current OneKey wallet by its BLE binding', () => {
    expect(
      isWalletConnectedByHardwareStatus({
        wallet: {
          associatedDeviceInfo: {
            connectId: 'USB-ID',
            bleConnectId: 'BLE-ID',
          },
        },
        connectedDeviceKeys: new Set(['BLE-ID']),
      }),
    ).toBe(true);
  });
});
