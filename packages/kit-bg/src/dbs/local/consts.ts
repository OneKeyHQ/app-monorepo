import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

export const IS_DB_BUCKET_SUPPORT = Boolean(
  platformEnv.isRuntimeBrowser &&
    (globalThis?.navigator as INavigator)?.storageBuckets,
);

const LOCAL_DB_NAME = 'OneKeyV5';
const LOCAL_DB_VERSION = 13;

// ----------------------------------------------

export const INDEXED_DB_NAME = (bucketName: EIndexedDBBucketNames) =>
  `${LOCAL_DB_NAME}-${bucketName.split('_')[0]}`;
export const LEGACY_INDEXED_DB_NAME = LOCAL_DB_NAME;
export const INDEXED_DB_VERSION = LOCAL_DB_VERSION;
export const REALM_DB_NAME = LOCAL_DB_NAME;
export const REALM_DB_VERSION = LOCAL_DB_VERSION;
export const ENABLE_INDEXEDDB_BUCKET = true;

// ---------------------------------------------- const

export const ALL_LOCAL_DB_STORE_NAMES: ELocalDBStoreNames[] =
  Object.values(ELocalDBStoreNames);

export const storeNameSupportCreatedAt = [
  ELocalDBStoreNames.SignedMessage,
  ELocalDBStoreNames.SignedTransaction,
  ELocalDBStoreNames.ConnectedSite,
];

export const INDEXED_DB_BUCKET_PRESET_STORE_NAMES = {
  [EIndexedDBBucketNames.account]: [
    ELocalDBStoreNames.Account,
    ELocalDBStoreNames.CloudSyncItem,
    ELocalDBStoreNames.Context,
    ELocalDBStoreNames.Credential,
    ELocalDBStoreNames.Device,
    ELocalDBStoreNames.IndexedAccount,
    ELocalDBStoreNames.Wallet,
  ],
  [EIndexedDBBucketNames.address]: [ELocalDBStoreNames.Address],
  [EIndexedDBBucketNames.archive]: [
    ELocalDBStoreNames.SignedMessage,
    ELocalDBStoreNames.SignedTransaction,
    ELocalDBStoreNames.ConnectedSite,
    ELocalDBStoreNames.HardwareHomeScreen,
  ],
};
// ---------------------------------------------- enums
export enum EDBAccountType {
  SIMPLE = 'simple',
  UTXO = 'utxo',
  VARIANT = 'variant',
  // used for allNetworks
  FAKE = 'FAKE',
}
export enum EDBCredentialType {
  SOFTWARE = 'software',
  HARDWARE = 'hardware',
  PRIVATE_KEY = 'private_key',
  WATCHING = 'watching',
}
