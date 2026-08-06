import { EDeviceType } from '@onekeyfe/hd-shared';

import type { IDeviceType } from '@onekeyfe/hd-core';

export const NEO_DEVICE_TYPE = EDeviceType.Neo;

export function isProtocolV2ProductType(
  deviceType: IDeviceType | string | null | undefined,
): boolean {
  return deviceType === EDeviceType.Pro2 || deviceType === NEO_DEVICE_TYPE;
}

export function supportsHardwareQrWallet(
  deviceType: IDeviceType | string | null | undefined,
): boolean {
  return deviceType === EDeviceType.Pro || deviceType === EDeviceType.Pro2;
}
