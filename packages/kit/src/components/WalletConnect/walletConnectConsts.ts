import { Platform } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getTimeDurationMs } from '../../utils/helper';

export const WALLET_CONNECT_STORAGE_KEY_WALLET_SIDE =
  'onekey@walletconnect-wallet-side';
export const WALLET_CONNECT_STORAGE_KEY_DAPP_SIDE =
  'onekey@walletconnect-dapp-side';

export const WALLET_CONNECT_WALLETS_LIST =
  'https://explorer.walletconnect.com/registry?type=wallet';
// export const WALLET_CONNECT_BRIDGE = 'https://bridge.walletconnect.org'; // official bridge
export const WALLET_CONNECT_BRIDGE = 'https://walletconnectbridge.onekey.so'; // OneKey self-host bridge
export const WALLET_CONNECT_PROTOCOL = 'wc';
export const WALLET_CONNECT_VERSION = 1;
export const WALLET_CONNECT_V2_PROJECT_ID = '5e21f5018bfdeb78af03187a432a301d';

//  timeout 20s
export const WALLET_CONNECT_CONNECTION_TIMEOUT = getTimeDurationMs({
  seconds: 20,
});

// add some delay to make sure sendTransaction message has been sent by websocket
export const WALLET_CONNECT_OPEN_WALLET_APP_DELAY = 3000;
export const WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING = 6000;
export const WALLET_CONNECT_SEND_SHOW_MISMATCH_CONFIRM_DELAY = 3000;
export const WALLET_CONNECT_SEND_SHOW_RECONNECT_QRCODE_MODAL_DELAY = 2000;
export const WALLET_CONNECT_SEND_SHOW_DISCONNECT_BUTTON_DELAY =
  getTimeDurationMs({
    seconds: 10,
  });

export const WALLET_CONNECT_IS_NATIVE_QRCODE_MODAL = platformEnv.isNative;
// export const WALLET_CONNECT_IS_NATIVE_QRCODE_MODAL = true;

export const ONEKEY_APP_DEEP_LINK_NAME = 'onekey-wallet';
export const ONEKEY_APP_DEEP_LINK = `${ONEKEY_APP_DEEP_LINK_NAME}://`; // onekey:// will open onekey legacy
export const WALLET_CONNECT_DEEP_LINK_NAME = 'wc';
export const WALLET_CONNECT_DEEP_LINK = `${WALLET_CONNECT_DEEP_LINK_NAME}://`;

export const WALLET_CONNECT_PROTOCOL_PREFIXES = [
  ONEKEY_APP_DEEP_LINK_NAME,
  WALLET_CONNECT_DEEP_LINK_NAME,
  'ethereum',
];

const platformName = [
  process.env.ONEKEY_PLATFORM ?? '',
  process.env.EXT_CHANNEL ?? '',
  Platform.OS ?? '',
]
  .filter(Boolean)
  .join('-');

// web platform default
let platformNameShort = 'Wallet';
if (platformEnv.isNativeAndroid) {
  platformNameShort = 'Android';
}
if (platformEnv.isNativeIOS) {
  platformNameShort = 'iOS';
}
if (platformEnv.isDesktop) {
  platformNameShort = 'Desktop';
}
if (platformEnv.isExtension) {
  platformNameShort = 'Extension';
}

export const WALLET_CONNECT_CLIENT_META = {
  name: `OneKey ${platformNameShort}`,
  description: 'Connect with OneKey',
  // wallet-connect identify different dapps by url
  url: `https://${platformName}.onekey.so`,
  icons: [
    'https://web.onekey-asset.com/portal/b688e1435d0d1e2e92581eb8dd7442c88da36049/icons/icon-256x256.png',
    'https://www.onekey.so/favicon.ico',
    // 'https://example.walletconnect.org/favicon.ico'
  ],
};

export const WALLET_CONNECT_WALLET_NAMES = {
  'MetaMask': 'MetaMask',
  'OKX Wallet': 'OKX Wallet',
  'Trust Wallet': 'Trust Wallet',
  'Rainbow': 'Rainbow',
  'imToken': 'imToken',
  'TokenPocket': 'TokenPocket',
  'BitKeep': 'BitKeep',
  'Zerion': 'Zerion',
  '1inch': '1inch Wallet',
};

export const WALLET_CONNECT_INSTITUTION_WALLET_NAMES = {
  'Fireblocks': 'Fireblocks',
  'Amber': 'Amber',
  'Cobo Wallet': 'Cobo Wallet',
  'Jade Wallet': 'Jade Wallet',
};

// Institutional wallets that are not on the walletconnect authentication list
export const WalletServiceWithoutVerify = [
  {
    id: 'Amber',
    name: 'Amber',
  },
  {
    id: 'CoboWallet',
    name: 'Cobo Wallet',
  },
];
