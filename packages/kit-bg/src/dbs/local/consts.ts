import { ELocalDBStoreNames } from './localDBStoreNames';

// ---------------------------------------------- const

export const INDEXED_DB_NAME = 'OneKey';
export const INDEXED_DB_VERSION = 9; // 8
export const REALM_DB_NAME = 'OneKey.realm';
export const REALM_DB_VERSION = 19; // 18

export const DEFAULT_VERIFY_STRING = 'OneKey';
export const DB_MAIN_CONTEXT_ID = 'mainContext';
export const WALLET_TYPE_HD = 'hd';
export const WALLET_TYPE_HW = 'hw';
export const WALLET_TYPE_IMPORTED = 'imported'; // as walletId
export const WALLET_TYPE_WATCHING = 'watching'; // as walletId
export const WALLET_TYPE_EXTERNAL = 'external'; // as walletId
export const ALL_LOCAL_DB_STORE_NAMES: ELocalDBStoreNames[] =
  Object.values(ELocalDBStoreNames);

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
