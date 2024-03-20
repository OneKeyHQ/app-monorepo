import { Platform } from 'react-native';

import {
  ONEKEY_APP_DEEP_LINK,
  WalletConnectUniversalLinkFull,
} from '../consts/deeplinkConsts';
import {
  IMPL_COSMOS,
  IMPL_DOT,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_TRON,
} from '../engine/engineConsts';
import platformEnv from '../platformEnv';

import type {
  ICaipsInfo,
  INamespaceUnion,
  IWalletConnectLoggerLevel,
} from './types';

export const DAPP_SIDE_SINGLE_WALLET_MODE = false;

export const WALLET_CONNECT_V2_PROJECT_ID = '5e21f5018bfdeb78af03187a432a301d';
// checkIsDefined(process.env.WALLETCONNECT_PROJECT_ID); // not working

export const WALLET_CONNECT_RELAY_URL = 'wss://relay.walletconnect.com';
export const WALLET_CONNECT_LOGGER_LEVEL: IWalletConnectLoggerLevel = 'error';

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
  // https://explorer-api.walletconnect.com/v3/all?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=40&page=1&search=onekey&build=1710747625972
  redirect: platformEnv.isNative
    ? {
        native: ONEKEY_APP_DEEP_LINK, // 'onekey-wallet://',
        universal: WalletConnectUniversalLinkFull, // 'https://app.onekey.so/wc/connect',
      }
    : (undefined as any),
};

export const namespaceToImplsMap: Record<INamespaceUnion, string> = {
  eip155: IMPL_EVM,
  solana: IMPL_SOL,
  cosmos: IMPL_COSMOS,
  polkadot: IMPL_DOT,
  tron: IMPL_TRON,
};

export const implToNamespaceMap: {
  [impl: string]: INamespaceUnion;
} = {
  [IMPL_EVM]: 'eip155',
  [IMPL_SOL]: 'solana',
  [IMPL_COSMOS]: 'cosmos',
  [IMPL_DOT]: 'polkadot',
  [IMPL_TRON]: 'tron',
};

// https://chainagnostic.org/
export const caipsToNetworkMap: Record<string, ICaipsInfo[]> = {
  solana: [
    {
      caipsChainId: '4sGjMW1sUnHzSxGspuhpqLDx6wiyjNtZ',
      networkId: 'sol--101',
      impl: IMPL_SOL,
      namespace: 'solana',
    },
    {
      caipsChainId: '8E9rvCKLFQia2Y35HXjjpWzj8weVo44K',
      networkId: 'sol--103',
      impl: IMPL_SOL,
      namespace: 'solana',
    },
  ],
  polkadot: [
    {
      caipsChainId: '91b171bb158e2d3848fa23a9f1c25182',
      networkId: 'dot--polkadot',
      impl: IMPL_DOT,
      namespace: 'polkadot',
    },
    {
      caipsChainId: 'b0a8d493285c2df73290dfb7e61f870f',
      networkId: 'dot--kusama',
      impl: IMPL_DOT,
      namespace: 'polkadot',
    },
  ],
};

// https://github.com/WalletConnect/web-examples/blob/main/advanced/dapps/react-dapp-v2/src/constants/default.ts#L60
// https://github.com/WalletConnect/web-examples/blob/main/advanced/wallets/react-wallet-v2/src/data/EIP155Data.ts#L126
export const WC_DAPP_SIDE_METHODS_EVM = [
  'eth_sendTransaction',
  'eth_sendRawTransaction',
  'eth_signTransaction',
  'eth_sign',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  // 'eth_signTypedData_v1',
];
// https://github.com/WalletConnect/web-examples/blob/main/advanced/dapps/react-dapp-v2/src/constants/default.ts#L72
export const WC_DAPP_SIDE_EVENTS_EVM = ['chainChanged', 'accountsChanged'];

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

/**
 * cosmos
 */
export const COSMOS_SIGNING_METHODS = {
  COSMOS_SIGN_DIRECT: 'cosmos_signDirect',
  COSMOS_SIGN_AMINO: 'cosmos_signAmino',
};

export const supportMethodsMap: Record<INamespaceUnion, string[]> = {
  eip155: Object.values(EIP155_SIGNING_METHODS),
  solana: [],
  cosmos: Object.values(COSMOS_SIGNING_METHODS),
  polkadot: [],
  tron: [],
};

export const supportEventsMap: Record<INamespaceUnion, string[]> = {
  eip155: ['accountsChanged', 'chainChanged'],
  solana: [],
  cosmos: [],
  polkadot: [],
  tron: [],
};

export const WalletConnectStartAccountSelectorNumber = 1000;
