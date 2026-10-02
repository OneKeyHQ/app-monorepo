import { EDeviceType } from '@onekeyfe/hd-shared';

import type { IDeviceType } from '@onekeyfe/hd-core';

export function isBluetoothFirmwareUpdateTransport({
  isNative,
}: {
  isNative: boolean | undefined;
}) {
  return Boolean(isNative);
}

/**
 * Pro, Pro 2 and Neo packages are large enough to be slow over Bluetooth, so
 * the app recommends the desktop client over USB before a Bluetooth update
 * starts. A stopgap until the transfer itself is faster (OK-64195, OK-64162).
 */
export function shouldSuggestDesktopUsbFirmwareUpdate({
  isNative,
  deviceType,
}: {
  isNative: boolean | undefined;
  deviceType: IDeviceType | undefined;
}) {
  return (
    isBluetoothFirmwareUpdateTransport({ isNative }) &&
    (deviceType === EDeviceType.Pro ||
      deviceType === EDeviceType.Pro2 ||
      deviceType === EDeviceType.Neo)
  );
}
