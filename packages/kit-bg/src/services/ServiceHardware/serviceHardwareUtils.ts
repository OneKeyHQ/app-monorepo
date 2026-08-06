import { EDeviceType } from '@onekeyfe/hd-shared';

import { isProtocolV2ProductType } from '@onekeyhq/shared/src/utils/hardwareDeviceTypes';

function hardwareLog(name: string, ...args: any[]) {
  console.log(`ServiceHardwareLog@${name}`, ...args);
}

function getHomeScreenServerDeviceType(deviceType: EDeviceType): EDeviceType {
  // TODO: Remove this compatibility mapping after Dashboard supports
  // deviceType=pro2 for wallet homescreen resources.
  return isProtocolV2ProductType(deviceType) ? EDeviceType.Pro : deviceType;
}

function getPro2HomeScreenSizeFallback({
  deviceType,
  thumbnail,
}: {
  deviceType: EDeviceType;
  thumbnail: boolean;
}): { width: number; height: number } | undefined {
  if (!isProtocolV2ProductType(deviceType)) return undefined;
  if (thumbnail) return undefined;
  return { width: 604, height: 1024 };
}

function getPro2NftSizeFallback({
  deviceType,
  thumbnail,
}: {
  deviceType: EDeviceType;
  thumbnail: boolean;
}): { width: number; height: number } | undefined {
  if (!isProtocolV2ProductType(deviceType)) return undefined;
  return thumbnail ? { width: 263, height: 263 } : { width: 540, height: 540 };
}

export default {
  getHomeScreenServerDeviceType,
  getPro2HomeScreenSizeFallback,
  getPro2NftSizeFallback,
  hardwareLog,
};
