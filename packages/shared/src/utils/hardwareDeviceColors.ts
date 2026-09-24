import { EDeviceType } from '@onekeyfe/hd-shared';

import { NEO_DEVICE_TYPE } from './hardwareDeviceTypes';

import type { IDeviceType } from '@onekeyfe/hd-core';

/**
 * The finishes the Pro 2 and the Neo ship in — the only OneKey models
 * that come in more than one color the app tells apart. The names are
 * the suffixes of the per-color avatar art (Pro2Silver, NeoPink) and the
 * keys of the per-color replica shells.
 */
export type IPro2DeviceColor = 'Black' | 'Silver' | 'Orange';
export type INeoDeviceColor = 'Black' | 'White' | 'Green' | 'Pink';
export type IHardwareDeviceColor = IPro2DeviceColor | INeoDeviceColor;

/**
 * A Pro 2 / Neo serial number ends in its color letter (hardware team,
 * 2026-09-01; B settled 2026-09-22): A black, B white on the Neo and
 * silver on the Pro 2, D orange, E green, F pink. Neither model ships a
 * transparent SKU. A letter the model does not come in, or no serial at
 * all, resolves to nothing — every surface then wears the model's default
 * finish, the Pro 2 in black and the Neo in white (avatar and replica
 * alike).
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

export function getPro2DeviceColor(
  serialNo: string | undefined,
): IPro2DeviceColor | undefined {
  return PRO2_SERIAL_COLORS[serialColorLetter(serialNo)];
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
  if (deviceType === EDeviceType.Pro2) {
    return getPro2DeviceColor(serialNo);
  }
  if (deviceType === NEO_DEVICE_TYPE) {
    return getNeoDeviceColor(serialNo);
  }
  return undefined;
}
