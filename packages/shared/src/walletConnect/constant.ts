import { Platform } from 'react-native';

import platformEnv from '../platformEnv';

export const WALLET_CONNECT_V2_PROJECT_ID =
  process.env.WALLETCONNECT_PROJECT_ID;

const platformName = [
  process.env.ONEKEY_PLATFORM ?? '',
  process.env.EXT_CHANNEL ?? '',
  Platform.OS ?? '',
]
  .filter(Boolean)
  .join('-');

if (!platformName) {
  throw new Error('platformName is empty');
}

function getPlatformShortName() {
  if (platformEnv.isNativeAndroid) {
    return 'Android';
  }
  if (platformEnv.isNativeIOS) {
    return 'iOS';
  }
  if (platformEnv.isDesktop) {
    return 'Desktop';
  }
  if (platformEnv.isExtension) {
    return 'Extension';
  }
  return 'Wallet';
}

export const WALLET_CONNECT_CLIENT_META = {
  name: `OneKey ${getPlatformShortName()}`,
  description: 'Connect with OneKey',
  // wallet-connect identify different dApps by url
  url: `https://${platformName}.onekey.so`,
  icons: [
    'https://web.onekey-asset.com/portal/b688e1435d0d1e2e92581eb8dd7442c88da36049/icons/icon-256x256.png',
    'https://www.onekey.so/favicon.ico',
  ],
};
