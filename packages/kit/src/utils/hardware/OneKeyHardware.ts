import { getDeviceTypeByDeviceId as getDeviceTypeByDeviceIdUtil } from '@onekeyfe/hd-core';

import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import type { IDeviceType, IVersionArray } from '@onekeyfe/hd-core';

export const getDeviceTypeByDeviceId = (deviceId?: string): IDeviceType =>
  getDeviceTypeByDeviceIdUtil(deviceId);

export const getDeviceFirmwareVersion = (
  features: IOneKeyDeviceFeatures | undefined,
): IVersionArray => {
  if (!features) return [0, 0, 0];

  if (features.onekey_version) {
    return features.onekey_version.split('.') as unknown as IVersionArray;
  }
  return [
    features.major_version,
    features.minor_version,
    features.patch_version,
  ];
};
