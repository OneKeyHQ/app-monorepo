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
 * Above this many bytes a Bluetooth update takes longer than people accept
 * (about four minutes at the ~20 KB/s the Pro 2 family reaches, slower on
 * Pro), so the app recommends the desktop client over USB first.
 */
export const DESKTOP_USB_SUGGESTION_MIN_TRANSFER_BYTES = 5 * 1024 * 1024;

/**
 * Whether to recommend the desktop client over USB before a Bluetooth update:
 * Pro, Pro 2 and Neo, and only for a large package. The size is the release
 * check's estimate of the bytes the device will receive (the firmware plus,
 * for the Pro 2 family, the resource archive only when the device is below
 * the manifest's `resources.fullRefreshVersion`). Without a size nothing is
 * suggested. A stopgap until the transfer itself is faster (OK-64195,
 * OK-64162).
 */
export function shouldSuggestDesktopUsbFirmwareUpdate({
  isNative,
  deviceType,
  estimatedTransferBytes,
}: {
  isNative: boolean | undefined;
  deviceType: IDeviceType | undefined;
  estimatedTransferBytes: number | undefined;
}) {
  return (
    isBluetoothFirmwareUpdateTransport({ isNative }) &&
    (deviceType === EDeviceType.Pro ||
      deviceType === EDeviceType.Pro2 ||
      deviceType === EDeviceType.Neo) &&
    estimatedTransferBytes !== undefined &&
    estimatedTransferBytes > DESKTOP_USB_SUGGESTION_MIN_TRANSFER_BYTES
  );
}
