import { EDeviceType } from '@onekeyfe/hd-shared';

import { EHardwareTransportType } from '@onekeyhq/shared/types';

import type { IDeviceType } from '@onekeyfe/hd-core';

export function isBluetoothFirmwareUpdateTransport({
  isNative,
  hardwareTransportType,
}: {
  isNative: boolean | undefined;
  hardwareTransportType?: EHardwareTransportType;
}) {
  if (!isNative) {
    return false;
  }
  if (hardwareTransportType === EHardwareTransportType.NativeUsb) {
    return false;
  }
  return true;
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
  hardwareTransportType,
  deviceType,
  estimatedTransferBytes,
}: {
  isNative: boolean | undefined;
  hardwareTransportType?: EHardwareTransportType;
  deviceType: IDeviceType | undefined;
  estimatedTransferBytes: number | undefined;
}) {
  return (
    isBluetoothFirmwareUpdateTransport({ isNative, hardwareTransportType }) &&
    (deviceType === EDeviceType.Pro ||
      deviceType === EDeviceType.Pro2 ||
      deviceType === EDeviceType.Neo) &&
    estimatedTransferBytes !== undefined &&
    estimatedTransferBytes > DESKTOP_USB_SUGGESTION_MIN_TRANSFER_BYTES
  );
}
