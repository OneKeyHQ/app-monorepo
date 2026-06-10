import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import {
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
    ]);
    expect(
      isWalletConnectedByHardwareStatus({
        wallet,
        connectedDeviceKeys: new Set(['onekey-device-id']),
      }),
    ).toBe(true);
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
});
