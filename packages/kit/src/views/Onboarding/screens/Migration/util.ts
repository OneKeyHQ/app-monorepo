import { deviceName } from 'expo-device';

import type { ICON_NAMES } from '@onekeyhq/components';
import type { DeviceInfo } from '@onekeyhq/engine/src/types/migrate';
import store from '@onekeyhq/kit/src/store';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ONEKEY_APP_DEEP_LINK } from '../../../../components/WalletConnect/walletConnectConsts';

function parseCloudData(cloudData: any) {
  const {
    public: publicOld,
    private: privateOld,

    publicData,
    privateData,
    ...rest
  } = cloudData;
  if (publicData && privateData) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return {
      public: publicData,
      private: privateData,
      ...rest,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return {
    public: publicOld,
    private: privateOld,
    ...rest,
  };
}

function shuffle(string: string) {
  const a = string.split('');
  const n = a.length;

  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a.join('');
}

const randomString = (
  length = 20,
  wishlist = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz~!@-#$',
) =>
  Array.from(crypto.getRandomValues(new Uint32Array(length)))
    .map((x) => wishlist[x % wishlist.length])
    .join('');

function generatePassword(length: number) {
  if (length < 10) {
    throw new Error('password too short');
  }
  const randomString1 = randomString(Math.floor(length / 3), '0123456789');
  const randomString2 = randomString(
    Math.floor(length / 3),
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  );
  const randomString3 = randomString(Math.floor(length / 3), '~!@-#$^');
  return shuffle(randomString1 + randomString2 + randomString3);
}

function addressWithoutHttp(address: string) {
  let copyAddress = address;
  if (copyAddress.startsWith('http://')) {
    copyAddress = copyAddress.replace('http://', '');
  }
  if (copyAddress.endsWith('/')) {
    copyAddress = copyAddress.slice(0, copyAddress.length - 1);
  }
  return copyAddress;
}

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
    deviceName: deviceName ?? 'unknown',
    platform: process.env.ONEKEY_PLATFORM ?? 'unknown',
    channel: platformEnv.distributionChannel,
    version,
    buildNumber,
  };
}

const OneKeyMigrateQRCodePrefix = `${ONEKEY_APP_DEEP_LINK}migrate/`;

const MigrationEnable = !platformEnv.isWeb;

export {
  parseDeviceInfo,
  deviceInfo,
  OneKeyMigrateQRCodePrefix,
  MigrationEnable,
  generatePassword,
  randomString,
  shuffle,
  addressWithoutHttp,
  parseCloudData,
};
