import type { EV4LocalDBStoreNames } from './v4localDBStoreNames';
import type {
  IV4DBAccount,
  IV4DBAccountDerivation,
  IV4DBContext,
  IV4DBCredentialBase,
  IV4DBDevice,
  IV4DBWallet,
} from './v4localDBTypesSchema';
import type { V4RealmSchemaAccount } from './v4realm/schemas/V4RealmSchemaAccount';
import type { V4RealmSchemaAccountDerivation } from './v4realm/schemas/V4RealmSchemaAccountDerivation';
import type { V4RealmSchemaContext } from './v4realm/schemas/V4RealmSchemaContext';
import type { V4RealmSchemaCredential } from './v4realm/schemas/V4RealmSchemaCredential';
import type { V4RealmSchemaDevice } from './v4realm/schemas/V4RealmSchemaDevice';
import type { V4RealmSchemaWallet } from './v4realm/schemas/V4RealmSchemaWallet';
import type { DBSchema, IDBPObjectStore } from 'idb';

export interface IV4LocalDBSchemaMap {
  [EV4LocalDBStoreNames.Context]: IV4DBContext;
  [EV4LocalDBStoreNames.Credential]: IV4DBCredentialBase;
  [EV4LocalDBStoreNames.Wallet]: IV4DBWallet;
  [EV4LocalDBStoreNames.Account]: IV4DBAccount;
  [EV4LocalDBStoreNames.AccountDerivation]: IV4DBAccountDerivation;
  [EV4LocalDBStoreNames.Device]: IV4DBDevice;
}

export interface IV4RealmDBSchemaMap {
  [EV4LocalDBStoreNames.Context]: V4RealmSchemaContext;
  [EV4LocalDBStoreNames.Credential]: V4RealmSchemaCredential;
  [EV4LocalDBStoreNames.Wallet]: V4RealmSchemaWallet;
  [EV4LocalDBStoreNames.Account]: V4RealmSchemaAccount;
  [EV4LocalDBStoreNames.AccountDerivation]: V4RealmSchemaAccountDerivation;
  [EV4LocalDBStoreNames.Device]: V4RealmSchemaDevice;
}

export interface IV4IndexedDBSchemaMap extends DBSchema {
  [EV4LocalDBStoreNames.AccountDerivation]: {
    key: string;
    value: IV4DBAccountDerivation;
  };
  [EV4LocalDBStoreNames.Account]: {
    key: string;
    value: IV4DBAccount;
    // indexes: { date: Date; title: string };
  };
  [EV4LocalDBStoreNames.Context]: {
    key: string;
    value: IV4DBContext;
  };
  [EV4LocalDBStoreNames.Credential]: {
    key: string;
    value: IV4DBCredentialBase;
  };
  [EV4LocalDBStoreNames.Device]: {
    key: string;
    value: IV4DBDevice;
  };
  [EV4LocalDBStoreNames.Wallet]: {
    key: string;
    value: IV4DBWallet;
  };
}

export type IV4LocalDBTransactionStores = {
  [EV4LocalDBStoreNames.Context]: IDBPObjectStore<
    IV4IndexedDBSchemaMap,
    EV4LocalDBStoreNames.Context[],
    EV4LocalDBStoreNames.Context,
    'readwrite'
  >;
  [EV4LocalDBStoreNames.Credential]: IDBPObjectStore<
    IV4IndexedDBSchemaMap,
    EV4LocalDBStoreNames.Credential[],
    EV4LocalDBStoreNames.Credential,
    'readwrite'
  >;
  [EV4LocalDBStoreNames.Wallet]: IDBPObjectStore<
    IV4IndexedDBSchemaMap,
    EV4LocalDBStoreNames.Wallet[],
    EV4LocalDBStoreNames.Wallet,
    'readwrite'
  >;
  [EV4LocalDBStoreNames.Account]: IDBPObjectStore<
    IV4IndexedDBSchemaMap,
    EV4LocalDBStoreNames.Account[],
    EV4LocalDBStoreNames.Account,
    'readwrite'
  >;

  [EV4LocalDBStoreNames.AccountDerivation]: IDBPObjectStore<
    IV4IndexedDBSchemaMap,
    EV4LocalDBStoreNames.AccountDerivation[],
    EV4LocalDBStoreNames.AccountDerivation,
    'readwrite'
  >;
  [EV4LocalDBStoreNames.Device]: IDBPObjectStore<
    IV4IndexedDBSchemaMap,
    EV4LocalDBStoreNames.Device[],
    EV4LocalDBStoreNames.Device,
    'readwrite'
  >;
};
