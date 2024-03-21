import { STORE_STORAGE_VERSION } from '@walletconnect/core';
import { safeJsonParse, safeJsonStringify } from '@walletconnect/safe-json';
import {
  SESSION_CONTEXT,
  SIGN_CLIENT_STORAGE_PREFIX,
} from '@walletconnect/sign-client';
import { isEmpty, isNil } from 'lodash';

import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import type { IWalletConnectSession } from '@onekeyhq/shared/src/walletConnect/types';

import type { IKeyValueStorage } from '@walletconnect/keyvaluestorage';

// https://github.com/WalletConnect/walletconnect-utils/blob/master/misc/keyvaluestorage/src/react-native/index.ts
// https://github.com/WalletConnect/walletconnect-monorepo/blob/v2.0/packages/core/src/controllers/store.ts#L78
function buildStorageKey({ prefix, name }: { prefix: string; name: string }) {
  // return this.storagePrefix + this.version + this.core.customStoragePrefix + "//" + this.name;
  // return `${CORE_STORAGE_PREFIX}${STORE_STORAGE_VERSION}//${name}`;
  return `${prefix}${STORE_STORAGE_VERSION}//${name}`;
}

function buildWalletConnectStorageWithKeyPrefix(prefix: string) {
  const newKey = (key: string) => `${prefix}>${key}`;
  const storage: IKeyValueStorage & {
    getSessions: () => Promise<IWalletConnectSession[]>;
  } = {
    async getKeys() {
      return appStorage
        .getAllKeys()
        .then((keys) => keys.map((key) => newKey(key)));
    },
    async getEntries() {
      throw new Error(
        'WalletConnectStorageWithKeyPrefix ERROR: getEntries not implemented',
      );
    },
    async getItem<T = any>(key: string) {
      const text = (await appStorage.getItem(newKey(key))) as
        | string
        | null
        | undefined;
      if (!text || isEmpty(text) || isNil(text)) {
        // getItem() should return undefined if null, null may cause `Cannot convert undefined or null to object` in sdk
        return undefined;
      }
      return safeJsonParse<T>(text) as T;
    },
    async setItem(key: string, value: any) {
      return appStorage.setItem(newKey(key), safeJsonStringify(value));
    },
    async removeItem(key: string) {
      return appStorage.removeItem(newKey(key));
    },
    async getSessions(): Promise<IWalletConnectSession[]> {
      const sessions = await this.getItem(
        buildStorageKey({
          prefix: SIGN_CLIENT_STORAGE_PREFIX,
          name: SESSION_CONTEXT,
        }),
      );
      if (isEmpty(sessions)) {
        return [];
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return sessions || [];
    },
  };
  return storage;
}
const walletConnectStorage = {
  dappSideStorage: buildWalletConnectStorageWithKeyPrefix('dapp'),
  walletSideStorage: buildWalletConnectStorageWithKeyPrefix('wallet'),
};

if (process.env.NODE_ENV !== 'production') {
  // @ts-ignore
  global.$$walletConnectStorage = walletConnectStorage;
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  global.$$walletConnectStorage.test = () => {
    void walletConnectStorage.dappSideStorage.getSessions().then((r) => {
      console.log(r?.[0]?.self?.metadata?.url);
      console.log(r?.[0]?.peer?.metadata?.url);
    });
  };
}

export default walletConnectStorage;
