import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { isSupportedHardwareWebUsbDevice } from './webDeviceFilters';

export { isSupportedHardwareWebUsbDevice };

type IUsbDeviceIdentity = Pick<
  USBDevice,
  'productId' | 'serialNumber' | 'vendorId'
>;

type IWalletHardwareIdentity = {
  deprecated?: boolean;
  passphraseState?: string;
  associatedDeviceInfo?: {
    vendor?: EHardwareVendor;
    deviceId?: string;
    uuid?: string;
    connectId?: string;
    usbConnectId?: string;
    bleConnectId?: string;
  };
};

export function getWebUsbConnectedDeviceKey(
  device: IUsbDeviceIdentity,
): string | undefined {
  if (!isSupportedHardwareWebUsbDevice(device)) {
    return undefined;
  }
  return device.serialNumber || undefined;
}

export function buildHardwareConnectedDeviceKeys({
  backgroundIdentityKeys,
  webUsbDevices,
}: {
  backgroundIdentityKeys: readonly string[];
  webUsbDevices: readonly IUsbDeviceIdentity[];
}): Set<string> {
  const connectedDeviceKeys = new Set(backgroundIdentityKeys);
  for (const device of webUsbDevices) {
    const key = getWebUsbConnectedDeviceKey(device);
    if (key) {
      connectedDeviceKeys.add(key);
    }
  }
  return connectedDeviceKeys;
}

export function getWalletHardwareConnectionKeys(
  wallet: IWalletHardwareIdentity | undefined,
): string[] {
  if (!wallet || wallet.deprecated || wallet.passphraseState) {
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
      : [
          device.deviceId,
          device.uuid,
          device.usbConnectId,
          device.connectId,
          device.bleConnectId,
        ];
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
