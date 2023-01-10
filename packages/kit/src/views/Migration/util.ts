import * as Device from 'expo-device';

import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function httpServerEnable() {
  if (platformEnv.isDesktop || platformEnv.isNative) {
    return true;
  }
  return false;
}

export function parseDeviceInfo(info: DeviceInfo) {
  const { platform, deviceName, channel } = info;
  let name = deviceName;
  let logo = '????';
  if (platform === 'app') {
    name = deviceName;
    if (channel?.includes('ios')) {
      logo = 'Apple';
    } else if (channel?.includes('android')) {
      logo = 'Android';
    }
  }
  if (platform === 'web') {
    name = 'Web';
    logo = '????';
  }
  if (platform === 'desktop') {
    name = 'Desktop';
    if (channel?.includes('mac')) {
      logo = 'Apple';
    } else if (channel?.includes('win')) {
      logo = 'Window';
    } else if (channel?.includes('linux')) {
      logo = 'linux';
    }
  }
  if (platform === 'ext') {
    name = 'Extension';
    if (channel === 'ext-chrome') {
      logo = 'chrome';
    } else if (channel === 'ext-firefox') {
      logo = 'firefox';
    }
  }

  return { name, logo };
}

export function deviceInfo() {
  const { version, buildNumber } = store.getState().settings;

  return {
    deviceName: Device.deviceName ?? 'unknown',
    platform: process.env.ONEKEY_PLATFORM ?? 'unknown',
    channel: platformEnv.distributionChannel,
    version,
    buildNumber,
  };
}
export { httpServerEnable };
