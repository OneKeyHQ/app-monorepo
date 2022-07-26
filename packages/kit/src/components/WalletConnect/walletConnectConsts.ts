import { Platform } from 'react-native';

export const WALLET_CONNECT_STORAGE_KEY_WALLET_SIDE =
  'onekey@walletconnect-wallet-side';
export const WALLET_CONNECT_STORAGE_KEY_DAPP_SIDE =
  'onekey@walletconnect-dapp-side';

export const WALLET_CONNECT_BRIDGE = 'https://bridge.walletconnect.org';
export const WALLET_CONNECT_PROTOCOL = 'wc';
export const WALLET_CONNECT_VERSION = 1;

// TODO onekey deeplink scheme
// export const ONEKEY_UNIVERSAL_LINK = 'yourappscheme://';
export const ONEKEY_UNIVERSAL_LINK = 'metamask://';

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
