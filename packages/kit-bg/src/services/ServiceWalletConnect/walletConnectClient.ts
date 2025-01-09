import { Core } from '@walletconnect/core';
import SignClient from '@walletconnect/sign-client';
import { Web3Wallet } from '@walletconnect/web3wallet';

import {
  WALLET_CONNECT_CLIENT_META,
  WALLET_CONNECT_LOGGER_LEVEL,
  WALLET_CONNECT_RELAY_URL,
  WALLET_CONNECT_V2_PROJECT_ID,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  IWalletConnectKeyValueStorage,
  IWalletConnectSignClient,
  IWalletConnectWeb3Wallet,
} from '@onekeyhq/shared/src/walletConnect/types';

import walletConnectStorage from './walletConnectStorage';

import type { CoreTypes } from '@walletconnect/types';

const sharedOptions: CoreTypes.Options = {
  projectId: WALLET_CONNECT_V2_PROJECT_ID,
  relayUrl: WALLET_CONNECT_RELAY_URL,
  logger: WALLET_CONNECT_LOGGER_LEVEL,
};
async function coreInit({
  storage,
}: {
  storage: IWalletConnectKeyValueStorage;
}) {
  return Core.init({
    storage,
    ...sharedOptions,
  });
}

let signClient: IWalletConnectSignClient | undefined;
async function getDappSideClient(): Promise<IWalletConnectSignClient> {
  if (!signClient) {
    const core = await coreInit({
      storage: walletConnectStorage.dappSideStorage,
    });
    signClient = await SignClient.init({
      ...sharedOptions,
      core,
      metadata: WALLET_CONNECT_CLIENT_META,
      storage: walletConnectStorage.dappSideStorage,
    });
  }
  return signClient;
}

let web3Wallet: IWalletConnectWeb3Wallet | undefined;
async function getWalletSideClient(): Promise<IWalletConnectWeb3Wallet> {
  if (!web3Wallet) {
    const core = await coreInit({
      storage: walletConnectStorage.walletSideStorage,
    });
    web3Wallet = await Web3Wallet.init({
      ...sharedOptions,
      core,
      metadata: WALLET_CONNECT_CLIENT_META,
    });
  }
  return web3Wallet;
}

export default {
  sharedOptions,
  // DappProvider -> SignClient -> Core -> Relayer(Websocket)
  getDappSideClient,
  // Web3Wallet -> Core -> Relayer(Websocket)
  getWalletSideClient,
};
