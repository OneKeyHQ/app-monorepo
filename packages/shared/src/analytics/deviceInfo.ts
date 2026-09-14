// oxlint-disable unicorn/prefer-global-this
/* eslint-disable unicorn/prefer-global-this */
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import {
  getDeviceTimeZone,
  getDeviceUtcOffsetMinutes,
} from '@onekeyhq/shared/src/utils/timeZoneUtils';

import type { IDeviceInfo, IGetDeviceInfo } from './type';

const deviceInfo = {
  deviceId: generateUUID(),
  deviceTimeZone: getDeviceTimeZone(),
  deviceUtcOffsetMinutes: getDeviceUtcOffsetMinutes(),
  screenHeight: typeof window !== 'undefined' ? window.innerHeight : undefined,
  screenWidth: typeof window !== 'undefined' ? window.innerWidth : undefined,
  referrer: typeof document !== 'undefined' ? document.referrer : undefined,
} as IDeviceInfo;

if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', () => {
    deviceInfo.screenHeight = window.innerHeight;
    deviceInfo.screenWidth = window.innerWidth;
  });
}

export const getDeviceInfo: IGetDeviceInfo = () => Promise.resolve(deviceInfo);
