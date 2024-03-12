import { ELocalDBStoreNames } from './localDBStoreNames';

// ---------------------------------------------- const

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
