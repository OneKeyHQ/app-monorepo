import { WalletKit } from '@reown/walletkit';
import { Core } from '@walletconnect/core';
import { KeyValueStorage } from '@walletconnect/keyvaluestorage';
import SignClient, { SESSION_CONTEXT } from '@walletconnect/sign-client';
import { isArray, isString } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  WALLET_CONNECT_CLIENT_META,
  WALLET_CONNECT_LOGGER_LEVEL,
  WALLET_CONNECT_RELAY_URL,
  WALLET_CONNECT_V2_PROJECT_ID,
} from '@onekeyhq/shared/src/walletConnect/constant';
import type {
  IWalletConnectSession,
  IWalletConnectSignClient,
  IWalletConnectWeb3Wallet,
} from '@onekeyhq/shared/src/walletConnect/types';

import type { CoreTypes } from '@walletconnect/types';

const sharedOptions: CoreTypes.Options = {
  projectId: WALLET_CONNECT_V2_PROJECT_ID,
  relayUrl: WALLET_CONNECT_RELAY_URL,
  logger: WALLET_CONNECT_LOGGER_LEVEL,
};
const DAPP_STORAGE_PREFIX = '1k-wc-dapp-kit';
const WALLET_STORAGE_PREFIX = '1k-wc-wallet-kit';

// TODO remove walletConnectStorage, use sharedStorage instead
let sharedStorage: KeyValueStorage | undefined;
function getSharedStorage(): KeyValueStorage {
  if (!sharedStorage) {
    sharedStorage = new KeyValueStorage();
  }
  return sharedStorage;
}

async function coreInit({
  storage,
  customStoragePrefix,
}: {
  storage: KeyValueStorage;
  customStoragePrefix: string;
}) {
  if (!customStoragePrefix) {
    throw new OneKeyLocalError('customStoragePrefix is required');
  }
  const coreInstance = await Core.init({
    customStoragePrefix,
    storage,
    ...sharedOptions,
  });
  return coreInstance;
}

let signClient: IWalletConnectSignClient | undefined;
async function getDappSideClient(): Promise<IWalletConnectSignClient> {
  if (!signClient) {
    const core = await coreInit({
      storage: getSharedStorage(),
      customStoragePrefix: DAPP_STORAGE_PREFIX,
    });
    signClient = await SignClient.init({
      ...sharedOptions,
      core,
      metadata: WALLET_CONNECT_CLIENT_META,
      storage: getSharedStorage(),
      customStoragePrefix: DAPP_STORAGE_PREFIX,
    });
  }
  return signClient;
}

let web3Wallet: IWalletConnectWeb3Wallet | undefined;
async function getWalletSideClient(): Promise<IWalletConnectWeb3Wallet> {
  if (!web3Wallet) {
    const core = await coreInit({
      storage: getSharedStorage(),
      customStoragePrefix: WALLET_STORAGE_PREFIX,
    });
    web3Wallet = await WalletKit.init({
      ...sharedOptions,
      core,
      metadata: WALLET_CONNECT_CLIENT_META,
    });
  }
  return web3Wallet;
}

async function getStorageSessions({
  storagePrefix,
}: {
  storagePrefix: string;
}): Promise<IWalletConnectSession[]> {
  const storage = getSharedStorage();
  const keys = await storage.getKeys();
  const endWith1 = `${storagePrefix}:${SESSION_CONTEXT}`; // web saved key
  const endWith2 = `${storagePrefix}//${SESSION_CONTEXT}`; // native saved key
  // console.log('getStorageSessionsKeys======', endWith1, endWith2, keys);
  const sessionKey = keys.find(
    (key) => key.endsWith(endWith1) || key.endsWith(endWith2),
  );
  if (!sessionKey) {
    return [];
  }
  const sessionString = await storage.getItem(sessionKey);
  if (isString(sessionString)) {
    try {
      const session = JSON.parse(sessionString) as IWalletConnectSession[];
      return session;
    } catch (e) {
      return [];
    }
  }
  if (isArray(sessionString)) {
    return sessionString as IWalletConnectSession[];
  }
  return [];
}

async function getWalletSideStorageSessions(): Promise<
  IWalletConnectSession[]
> {
  return getStorageSessions({
    storagePrefix: WALLET_STORAGE_PREFIX,
  });
}

async function getDappSideStorageSessions(): Promise<IWalletConnectSession[]> {
  return getStorageSessions({
    storagePrefix: DAPP_STORAGE_PREFIX,
  });
}

export default {
  sharedOptions,
  // DappProvider -> SignClient -> Core -> Relayer(Websocket)
  getDappSideClient,
  // Web3Wallet -> Core -> Relayer(Websocket)
  getWalletSideClient,
  getWalletSideStorageSessions,
  getDappSideStorageSessions,
};
