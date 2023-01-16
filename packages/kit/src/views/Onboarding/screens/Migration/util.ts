import * as Device from 'expo-device';

import type { ICON_NAMES } from '@onekeyhq/components';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

function httpServerEnable() {
  if (platformEnv.isDesktop || platformEnv.isNativeIOS) {
    return true;
  }
  return false;
}

// label and icon name:
// - Mobile, DevicePhoneMobileSolid (iOS, Android)
// - Tablet, DeviceTabletSolid (iPadOS, Android tablet)
// - Desktop, ComputerDesktopSolid (macOS, Windows, Linux)
// - Extension, PuzzlePieceSolid (Chrome Extension, Firefox Extension, Safari Extension, Edge Extension, Brave Extension)
// - Web, GlobeAltSolid (Web)
export function parseDeviceInfo(info: DeviceInfo) {
  const { platform, channel } = info;
  let name = 'Unknow';
  let logo: ICON_NAMES = 'QuestionMarkOutline';
  if (platform === 'app') {
    if (channel?.includes('native-ios-pad')) {
      name = 'Tablet';
      logo = 'DeviceTabletSolid';
    } else {
      name = 'Mobile';
      logo = 'DevicePhoneMobileSolid';
    }
  } else if (platform === 'web') {
    name = 'Web';
    logo = 'GlobeAltSolid';
  } else if (platform === 'desktop') {
    name = 'Desktop';
    logo = 'ComputerDesktopSolid';
  } else if (platform === 'ext') {
    name = 'Extension';
    logo = 'PuzzlePieceSolid';
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
