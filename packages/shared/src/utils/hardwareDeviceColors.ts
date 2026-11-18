import { EDeviceType } from '@onekeyfe/hd-shared';

import { NEO_DEVICE_TYPE } from './hardwareDeviceTypes';

import type { IDeviceType } from '@onekeyfe/hd-core';

/**
 * The Pro 2 and Neo finishes, named by the avatar suffixes (Pro2Silver,
 * NeoPink) and replica shell keys. 'Transparent' is the see-through
 * Classic 1s / Pure, which its serial number names (see below).
 */
export type IPro2DeviceColor = 'Black' | 'Silver' | 'Orange';
export type INeoDeviceColor = 'Black' | 'White' | 'Green' | 'Pink';
export type IHardwareDeviceColor =
  | IPro2DeviceColor
  | INeoDeviceColor
  | 'Transparent';

/**
 * A Pro 2 / Neo serial number ends in its color letter (hardware team,
 * 2026-09-01; B settled 2026-09-22): A black, B white on the Neo and
 * silver on the Pro 2 (the SN rules' "white"), D orange, E green, F pink.
 * Neither model ships a transparent SKU. Before connecting, a Pro 2
 * advertises the same letter over Bluetooth. A letter the model does not
 * come in, or no letter at all, resolves to nothing — every surface then
 * wears the model's default finish, the Pro 2 in black and the Neo in
 * white (avatar and replica alike).
 */
const PRO2_SERIAL_COLORS: Partial<Record<string, IPro2DeviceColor>> = {
  A: 'Black',
  B: 'Silver',
  D: 'Orange',
};
const NEO_SERIAL_COLORS: Partial<Record<string, INeoDeviceColor>> = {
  A: 'Black',
  B: 'White',
  E: 'Green',
  F: 'Pink',
};

function serialColorLetter(serialNo: string | undefined): string {
  return serialNo?.slice(-1) ?? '';
}

/** The Pro 2 finish a color letter names (see the table above). */
export function getPro2DeviceColorFromCode(
  colorCode: string | undefined,
): IPro2DeviceColor | undefined {
  return colorCode ? PRO2_SERIAL_COLORS[colorCode] : undefined;
}

export function getPro2DeviceColor(
  serialNo: string | undefined,
): IPro2DeviceColor | undefined {
  return getPro2DeviceColorFromCode(serialColorLetter(serialNo));
}

/**
 * The color a Bluetooth scan names before the device connects: the serial
 * number's color letter, advertised as the SDK's `bleColorCode`. It reads
 * the same table as the serial number, so the finish does not change once
 * the device connects; a model or letter without its own finish resolves
 * to nothing.
 */
export function getHardwareDeviceColorFromCode({
  deviceType,
  colorCode,
}: {
  deviceType: IDeviceType | string | null | undefined;
  colorCode: string | undefined;
}): IHardwareDeviceColor | undefined {
  if (deviceType === EDeviceType.Pro2) {
    return getPro2DeviceColorFromCode(colorCode);
  }
  return undefined;
}

export function getNeoDeviceColor(
  serialNo: string | undefined,
): INeoDeviceColor | undefined {
  return NEO_SERIAL_COLORS[serialColorLetter(serialNo)];
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
  if (deviceType === NEO_DEVICE_TYPE) {
    return getNeoDeviceColor(serialNo);
  }
  return undefined;
}
