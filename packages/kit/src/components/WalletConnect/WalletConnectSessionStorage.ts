import { isWalletConnectSession } from '@walletconnect/utils';

import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import {
  WALLET_CONNECT_STORAGE_KEY_DAPP_SIDE,
  WALLET_CONNECT_STORAGE_KEY_WALLET_SIDE,
} from './walletConnectConsts';

import type {
  ISessionStorage,
  IWalletConnectSession,
} from '@walletconnect/types';

// peerWallets, peerDapps
export class WalletConnectSessionStorage implements ISessionStorage {
  constructor({ storageId }: { storageId: string }) {
    this.storageId = storageId;
    if (!this.storageId) {
      throw new Error('WalletConnectSessionStorage ERROR: storageId required');
    }
  }

  static STORAGE_IDS = {
    DAPP_SIDE: WALLET_CONNECT_STORAGE_KEY_DAPP_SIDE,
    WALLET_SIDE: WALLET_CONNECT_STORAGE_KEY_WALLET_SIDE,
  };

  storageId = '';

  // @ts-ignore
  async getSession(): Promise<IWalletConnectSession | null> {
    let session = null;
    const jsonStr = (await appStorage.getItem(this.storageId)) as string;
    if (jsonStr) {
      try {
        const json = JSON.parse(jsonStr);
        if (json && isWalletConnectSession(json)) {
          session = json;
        }
      } catch (error) {
        debugLogger.common.error(
          'WalletConnectSessionStorage.getSession ERROR:',
          error,
        );
      }
    }

    return session;
  }

  setSession(session: IWalletConnectSession): IWalletConnectSession {
    if (!session.peerId) {
      throw new Error(
        'WalletConnectSessionStorage ERROR: peerId is required, please make sure this method is called after websocket connection ready.',
      );
    }
    // TODO setItem object
    // TODO try catch
    appStorage.setItem(this.storageId, JSON.stringify(session));
    return session;
  }

  removeSession(): void {
    appStorage.removeItem(this.storageId);
  }
}
