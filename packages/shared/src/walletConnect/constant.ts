import { Platform } from 'react-native';

import { IMPL_EVM } from '../engine/engineConsts';
import platformEnv from '../platformEnv';

import type { INamespaceUnion } from './types';

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

export const namespaceToImplsMap = {
  eip155: IMPL_EVM,
};

export const implToNamespaceMap = {
  [IMPL_EVM]: 'eip155',
};

/**
 * eip155
 */
export const EIP155_SIGNING_METHODS = {
  PERSONAL_SIGN: 'personal_sign',
  ETH_SIGN: 'eth_sign',
  ETH_SIGN_TRANSACTION: 'eth_signTransaction',
  ETH_SIGN_TYPED_DATA: 'eth_signTypedData',
  ETH_SIGN_TYPED_DATA_V3: 'eth_signTypedData_v3',
  ETH_SIGN_TYPED_DATA_V4: 'eth_signTypedData_v4',
  ETH_SEND_RAW_TRANSACTION: 'eth_sendRawTransaction',
  ETH_SEND_TRANSACTION: 'eth_sendTransaction',
};

export const EIP155_EVENTS = {
  ACCOUNT_CHANGED: 'accountsChanged',
  CHAIN_CHANGED: 'chainChanged',
};

export const supportMethodsMap: Record<INamespaceUnion, string[]> = {
  eip155: Object.values(EIP155_SIGNING_METHODS),
};
