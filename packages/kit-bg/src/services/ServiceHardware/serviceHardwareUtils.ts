import { EDeviceType } from '@onekeyfe/hd-shared';

function hardwareLog(name: string, ...args: any[]) {
  console.log(`ServiceHardwareLog@${name}`, ...args);
}

function getHomeScreenServerDeviceType(deviceType: EDeviceType): EDeviceType {
  // TODO: Remove this compatibility mapping after Dashboard supports
  // deviceType=pro2 for wallet homescreen resources.
  return deviceType === EDeviceType.Pro2 ? EDeviceType.Pro : deviceType;
}

function getPro2HomeScreenSizeFallback({
  deviceType,
  thumbnail,
}: {
  deviceType: EDeviceType;
  thumbnail: boolean;
}): { width: number; height: number } | undefined {
  if (deviceType !== EDeviceType.Pro2 || thumbnail) {
    return undefined;
  }
  return { width: 604, height: 1024 };
}

export default {
  getHomeScreenServerDeviceType,
  getPro2HomeScreenSizeFallback,
  hardwareLog,
};
