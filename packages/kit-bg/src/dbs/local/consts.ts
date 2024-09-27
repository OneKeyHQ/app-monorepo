import { ELocalDBStoreNames } from './localDBStoreNames';

const LOCAL_DB_NAME = 'OneKeyV5';
const LOCAL_DB_VERSION = 4;

// ----------------------------------------------

export const INDEXED_DB_NAME = LOCAL_DB_NAME;
export const INDEXED_DB_VERSION = LOCAL_DB_VERSION;
export const REALM_DB_NAME = LOCAL_DB_NAME;
export const REALM_DB_VERSION = LOCAL_DB_VERSION;

// ---------------------------------------------- const

export const ALL_LOCAL_DB_STORE_NAMES: ELocalDBStoreNames[] =
  Object.values(ELocalDBStoreNames);

export const storeNameSupportCreatedAt = [
  ELocalDBStoreNames.SignedMessage,
  ELocalDBStoreNames.SignedTransaction,
  ELocalDBStoreNames.ConnectedSite,
];
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
