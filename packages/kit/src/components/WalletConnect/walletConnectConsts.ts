import { Platform } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

export const WALLET_CONNECT_STORAGE_KEY_WALLET_SIDE =
  'onekey@walletconnect-wallet-side';
export const WALLET_CONNECT_STORAGE_KEY_DAPP_SIDE =
  'onekey@walletconnect-dapp-side';

export const WALLET_CONNECT_BRIDGE = 'https://bridge.walletconnect.org';
export const WALLET_CONNECT_PROTOCOL = 'wc';
export const WALLET_CONNECT_VERSION = 1;

// add some delay to make sure sendTransaction message has been sent by websocket
export const WALLET_CONNECT_OPEN_APP_DELAY = 3000;
export const WALLET_CONNECT_SHOW_MISMATCH_CONFIRM_DELAY = 3000;
export const WALLET_CONNECT_SHOW_QRCODE_MODAL_DELAY = 2000;
export const WALLET_CONNECT_SHOW_DISCONNECT_BUTTON_DELAY = 10 * 1000;

export const WALLET_CONNECT_IS_NATIVE_QRCODE_MODAL = platformEnv.isNative;
// export const WALLET_CONNECT_IS_NATIVE_QRCODE_MODAL = true;

export const ONEKEY_UNIVERSAL_LINK = 'onekeyx://'; // onekey:// will open onekey legacy

const platformName = [
  process.env.ONEKEY_PLATFORM ?? '',
  process.env.EXT_CHANNEL ?? '',
  Platform.OS ?? '',
]
  .filter(Boolean)
  .join('-');
export const WALLET_CONNECT_CLIENT_META = {
  description: 'Connect with OneKey',
  // wallet-connect identify different dapps by url
  url: `https://${platformName}.onekey.so`,
  icons: [
    'https://web.onekey-asset.com/portal/b688e1435d0d1e2e92581eb8dd7442c88da36049/icons/icon-256x256.png',
    'https://www.onekey.so/favicon.ico',
    // 'https://example.walletconnect.org/favicon.ico'
  ],
  name: `OneKey ${platformName}`,
};
