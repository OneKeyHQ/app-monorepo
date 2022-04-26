import { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import type { Features } from '@onekeyfe/js-sdk';

const isOnekeyDevice = (name: string | null, id?: string): boolean => {
  if (id?.startsWith?.('MI')) {
    return true;
  }

  // 过滤 BixinKeyxxx 和 Kxxxx
  // i 忽略大小写模式
  const re = /(BixinKey\d{10})|(K\d{4})/i;
  if (name && re.exec(name)) {
    return true;
  }
  return false;
};

export const getDeviceType = (
  features?: Partial<Features>,
): IOneKeyDeviceType => {
  if (!features || typeof features !== 'object' || !features.serial_no) {
    return 'classic';
  }

  const serialNo = features.serial_no;
  const miniFlag = serialNo.slice(0, 2);
  if (miniFlag.toLowerCase() === 'mi') return 'mini';
  return 'classic';
};

// TODO: write info at database
export const getDeviceTypeByDeviceId = (
  deviceId?: string,
): IOneKeyDeviceType => {
  if (!deviceId) {
    return 'classic';
  }

  const miniFlag = deviceId.slice(0, 2);
  if (miniFlag.toLowerCase() === 'mi') return 'mini';
  return 'classic';
};

export { isOnekeyDevice as default };
