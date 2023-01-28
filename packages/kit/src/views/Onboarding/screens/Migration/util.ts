import * as Device from 'expo-device';

import type { ICON_NAMES } from '@onekeyhq/components';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ONEKEY_APP_DEEP_LINK } from '../../../../components/WalletConnect/walletConnectConsts';

// label and icon name:
// - Mobile, DevicePhoneMobileSolid (iOS, Android)
// - Tablet, DeviceTabletSolid (iPadOS, Android tablet)
// - Desktop, ComputerDesktopSolid (macOS, Windows, Linux)
// - Extension, PuzzlePieceSolid (Chrome Extension, Firefox Extension, Safari Extension, Edge Extension, Brave Extension)
// - Web, GlobeAltSolid (Web)
function parseDeviceInfo(info: DeviceInfo) {
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

function deviceInfo() {
  const { version, buildNumber } = store.getState().settings;
  return {
    deviceName: Device.deviceName ?? 'unknown',
    platform: process.env.ONEKEY_PLATFORM ?? 'unknown',
    channel: platformEnv.distributionChannel,
    version,
    buildNumber,
  };
}

const OneKeyMigrateQRCodePrefix = `${ONEKEY_APP_DEEP_LINK}migrate`;

const MigrationEnable = true;

export {
  parseDeviceInfo,
  deviceInfo,
  OneKeyMigrateQRCodePrefix,
  MigrationEnable,
};
