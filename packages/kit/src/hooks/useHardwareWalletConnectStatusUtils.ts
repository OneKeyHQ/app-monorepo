import { ONEKEY_WEBUSB_FILTER } from '@onekeyfe/hd-shared';
import { TREZOR_WEBUSB_FILTERS } from '@onekeyfe/hwk-trezor-connector-webusb/constants';

import { EHardwareVendor } from '@onekeyhq/shared/types/device';

type IUsbDeviceIdentity = Pick<
  USBDevice,
  'productId' | 'serialNumber' | 'vendorId'
>;

type IWalletHardwareIdentity = {
  passphraseState?: string;
  associatedDeviceInfo?: {
    vendor?: EHardwareVendor;
    deviceId?: string;
    connectId?: string;
    usbConnectId?: string;
    bleConnectId?: string;
  };
};

function matchesUsbFilter(
  device: IUsbDeviceIdentity,
  filter: USBDeviceFilter,
): boolean {
  if (filter.vendorId !== undefined && filter.vendorId !== device.vendorId) {
    return false;
  }
  if (filter.productId !== undefined && filter.productId !== device.productId) {
    return false;
  }
  return true;
}

export function isSupportedHardwareWebUsbDevice(
  device: IUsbDeviceIdentity,
): boolean {
  return [...ONEKEY_WEBUSB_FILTER, ...TREZOR_WEBUSB_FILTERS].some((filter) =>
    matchesUsbFilter(device, filter),
  );
}

export function getWebUsbConnectedDeviceKey(
  device: IUsbDeviceIdentity,
): string | undefined {
  if (!isSupportedHardwareWebUsbDevice(device)) {
    return undefined;
  }
  return device.serialNumber || undefined;
}

export function getWalletHardwareConnectionKeys(
  wallet: IWalletHardwareIdentity | undefined,
): string[] {
  if (!wallet || wallet.passphraseState) {
    return [];
  }
  const device = wallet.associatedDeviceInfo;
  if (!device) {
    return [];
  }
  const vendor = device.vendor ?? EHardwareVendor.onekey;
  const keys =
    vendor === EHardwareVendor.trezor
      ? [device.connectId, device.usbConnectId, device.bleConnectId]
      : [device.deviceId];
  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

export function isWalletConnectedByHardwareStatus({
  wallet,
  connectedDeviceKeys,
}: {
  wallet: IWalletHardwareIdentity | undefined;
  connectedDeviceKeys: Set<string>;
}): boolean {
  return getWalletHardwareConnectionKeys(wallet).some((key) =>
    connectedDeviceKeys.has(key),
  );
}
