import { EV4LocalDBStoreNames } from './v4localDBStoreNames';

export const V4_INDEXED_DB_NAME = 'OneKey';
export const V4_INDEXED_DB_VERSION = 8; // v4 version: 8

export const V4_REALM_DB_NAME = 'OneKey.realm';
export const V4_REALM_DB_VERSION = 19; // v4 version: 19

export const V4_ALL_LOCAL_DB_STORE_NAMES: EV4LocalDBStoreNames[] =
  Object.values(EV4LocalDBStoreNames);

export const v4storeNameSupportCreatedAt: EV4LocalDBStoreNames[] = [
  // ELocalDBStoreNames.SignedMessage,
  // ELocalDBStoreNames.SignedTransaction,
  // ELocalDBStoreNames.ConnectedSite,
];
