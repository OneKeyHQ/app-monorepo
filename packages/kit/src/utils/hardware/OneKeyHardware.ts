import { IDeviceType, getDeviceType, getDeviceUUID } from '@onekeyfe/hd-core';

export const getDeviceTypeByDeviceId = (deviceId?: string): IDeviceType => {
  if (!deviceId) {
    return 'classic';
  }

  const miniFlag = deviceId.slice(0, 2);
  if (miniFlag.toLowerCase() === 'mi') return 'mini';
  return 'classic';
};

export { getDeviceType, getDeviceUUID };
