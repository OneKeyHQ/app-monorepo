import { EDeviceType } from '@onekeyfe/hd-shared';

import type { IDeviceType } from '@onekeyfe/hd-core';

/**
 * The Pro 2 finishes, named by the avatar suffixes and replica shell keys.
 */
export type IPro2DeviceColor = 'Black' | 'Silver' | 'Orange';
export type IHardwareDeviceColor = IPro2DeviceColor | 'Transparent';

/**
 * A Pro 2 serial number ends in its color letter (hardware team,
 * 2026-09-01; B settled 2026-09-22): A black, B silver, D orange. No
 * transparent SKU ships. A letter the model does not come in, or no
 * serial at all, resolves to nothing — every surface then wears the
 * default finish, black (avatar and replica alike).
 */
const PRO2_SERIAL_COLORS: Partial<Record<string, IPro2DeviceColor>> = {
  A: 'Black',
  B: 'Silver',
  D: 'Orange',
};

function serialColorLetter(serialNo: string | undefined): string {
  return serialNo?.slice(-1) ?? '';
}

export function getPro2DeviceColor(
  serialNo: string | undefined,
): IPro2DeviceColor | undefined {
  return PRO2_SERIAL_COLORS[serialColorLetter(serialNo)];
}

/** The color a serial number names, for the models that have one. */
export function getHardwareDeviceColor({
  deviceType,
  serialNo,
}: {
  deviceType: IDeviceType | string | null | undefined;
  serialNo: string | undefined;
}): IHardwareDeviceColor | undefined {
  if (
    (deviceType === EDeviceType.Classic1s ||
      deviceType === EDeviceType.ClassicPure) &&
    serialNo?.length === 11 &&
    serialNo.startsWith(deviceType === EDeviceType.Classic1s ? 'CL' : 'CP') &&
    serialNo.endsWith('C')
  ) {
    return 'Transparent';
  }
  if (deviceType === EDeviceType.Pro2) {
    return getPro2DeviceColor(serialNo);
  }
  return undefined;
}
