import type {
  DBAccount,
  DBAccountDerivation,
  DBCredential,
  DBDevice,
  DBWallet,
  OneKeyContext,
} from '../types';
import type { DBSchema } from 'idb';

export const INDEXED_DB_NAME = 'OneKey';
export const INDEXED_DB_VERSION = 9;

export enum EIndexedDBStoreNames {
  // **** increase INDEXED_DB_VERSION when add or remove store ****
  context = 'context',
  credentials = 'credentials',
  wallets = 'wallets',
  accounts = 'accounts',
  account_derivations = 'account_derivations',
  devices = 'devices',
  // test_new_store = 'test_new_store',
  // test_new_store1 = 'test_new_store1',
  // test_new_store2 = 'test_new_store2',
  // test_new_store3 = 'test_new_store3',
  // test_new_store4 = 'test_new_store4',
}

export interface IIndexedDBSchema extends DBSchema {
  [EIndexedDBStoreNames.context]: {
    key: string;
    value: OneKeyContext;
  };
  [EIndexedDBStoreNames.credentials]: {
    key: string;
    value: DBCredential;
  };
  [EIndexedDBStoreNames.wallets]: {
    key: string;
    value: DBWallet;
  };
  [EIndexedDBStoreNames.accounts]: {
    key: string;
    value: DBAccount;
    // indexes: { date: Date; title: string };
  };
  [EIndexedDBStoreNames.devices]: {
    key: string;
    value: DBDevice;
  };
  [EIndexedDBStoreNames.account_derivations]: {
    key: string;
    value: DBAccountDerivation;
  };
}
