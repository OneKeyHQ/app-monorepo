import type { RevealableSeed } from '@onekeyhq/core/src/secret';

import type {
  AccountType,
  CredentialType,
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from './consts';
import type { ELocalDBStoreNames } from './localDBStoreNames';
import type { RealmSchemaAccount } from './realm/schemas/RealmSchemaAccount';
import type { RealmSchemaAccountDerivation } from './realm/schemas/RealmSchemaAccountDerivation';
import type { RealmSchemaContext } from './realm/schemas/RealmSchemaContext';
import type { RealmSchemaCredential } from './realm/schemas/RealmSchemaCredential';
import type { RealmSchemaDevice } from './realm/schemas/RealmSchemaDevice';
import type { RealmSchemaWallet } from './realm/schemas/RealmSchemaWallet';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { DBSchema, IDBPObjectStore } from 'idb';

// ---------------------------------------------- base
export type BaseObject = {
  id: string;
};
export type HasName = BaseObject & {
  name: string;
};
export type OneKeyContext = {
  id: string; // DB_MAIN_CONTEXT_ID
  nextHD: number;
  verifyString: string;
  networkOrderChanged?: boolean;
  pendingWallets?: Array<string>;
  backupUUID: string;
};
export type IDbApiGetContextOptions = {
  verifyPassword?: string;
};

// ---------------------------------------------- credential
export type DBCredential = BaseObject & {
  credential: string;
};
export type PrivateKeyCredential = {
  type: CredentialType.PRIVATE_KEY;
  privateKey: Buffer;
  password: string;
};
export type StoredSeedCredential = {
  entropy: string;
  seed: string;
};
export type StoredPrivateKeyCredential = {
  privateKey: string;
};
export type StoredCredential =
  | StoredSeedCredential
  | StoredPrivateKeyCredential;
export type ExportedSeedCredential = {
  type: 'hd';
  entropy: Buffer;
  seed: Buffer;
};
export type ExportedPrivateKeyCredential = {
  type: 'imported';
  privateKey: Buffer;
};
export type ExportedCredential =
  | ExportedSeedCredential
  | ExportedPrivateKeyCredential;
export type IDBCredentialBase = {
  id: string;
  credential: string;
};
// ---------------------------------------------- wallet
export type IDBWalletId =
  | string // hd-xxx, hw-xxx
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;
export type IDBWalletIdSingleton =
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;
export type IDBWalletType =
  | typeof WALLET_TYPE_HD
  | typeof WALLET_TYPE_HW
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;
export type Wallet = HasName & {
  type: IDBWalletType;
  backuped: boolean;
  accounts: Array<string>;
  nextAccountIds: Record<string, number>; // purpose + cointype => index
  associatedDevice?: string; // alias to `deviceId`
  avatar?: Avatar;
  deviceType?: string;
  hidden?: boolean;
  passphraseState?: string;
};
export type DBWallet = Wallet;
export type CreateHDWalletParams = {
  password: string;
  rs: RevealableSeed;
  backuped: boolean;
  name?: string;
  avatar?: Avatar;
  nextAccountIds?: Record<string, number>;
};
export type CreateHWWalletParams = {
  id: string;
  name: string;
  avatar?: Avatar;
  connectId: string;
  deviceId?: string;
  deviceType: IDeviceType;
  deviceUUID: string;
  features: string;
  passphraseState?: string;
};
export type SetWalletNameAndAvatarParams = {
  name?: string;
  avatar?: Avatar;
};

// ---------------------------------------------- account
export type Avatar = {
  emoji: string | 'img'; // lazy load EmojiTypes
  bgColor: string;
};
export type IDBAvatar = Avatar;
export type DBBaseAccount = HasName & {
  type: AccountType;
  path: string;
  coinType: string;
  template?: string;
};
export type DBSimpleAccount = DBBaseAccount & {
  pub: string;
  address: string;
};
export type DBUTXOAccount = DBBaseAccount & {
  pub?: string; // TODO rename pubKey to pub
  xpub: string;
  xpubSegwit?: string; // wrap regular xpub into bitcoind native descriptor
  address: string; // Display/selected address
  addresses: Record<string, string>;
  customAddresses?: Record<string, string>; // for btc custom address
};
export type DBVariantAccount = DBBaseAccount & {
  pub: string;
  address: string; // Base address
  // VARIANT: Network -> address
  // UTXO: relPath -> address
  addresses: Record<string, string>;
};
export type DBAccount = DBSimpleAccount | DBUTXOAccount | DBVariantAccount;
export type DBAccountDerivation = BaseObject & {
  walletId: string;
  accounts: string[];
  template: string;
};
export type ISetAccountTemplateParams = {
  accountId: string;
  template: string;
};
export type IAddAccountDerivationParams = {
  walletId: string;
  accountId: string;
  impl: string;
  template: string;
  derivationStore?: IDBObjectStore;
};
export type ISetNextAccountIdsParams = {
  walletId: string;
  nextAccountIds: Record<string, number>;
};

// ---------------------------------------------- device
export type DevicePayload = {
  onDeviceInputPin?: boolean;
};
export type DBDevice = HasName & {
  features: string;
  mac: string;
  name: string;
  uuid: string;
  deviceId: string;
  deviceType: string;
  payloadJson: string;
  createdAt: number;
  updatedAt: number;
};
export type Device = Omit<DBDevice, 'payloadJson'> & {
  payload: DevicePayload;
};

// DB SCHEMA map ----------------------------------------------
export interface ILocalDBSchemaMap {
  [ELocalDBStoreNames.Context]: OneKeyContext;
  [ELocalDBStoreNames.Credential]: IDBCredentialBase;
  [ELocalDBStoreNames.Wallet]: DBWallet;
  [ELocalDBStoreNames.Account]: DBAccount;
  [ELocalDBStoreNames.AccountDerivation]: DBAccountDerivation;
  [ELocalDBStoreNames.Device]: DBDevice;
}

export interface IRealmDBSchemaMap {
  [ELocalDBStoreNames.Context]: RealmSchemaContext;
  [ELocalDBStoreNames.Credential]: RealmSchemaCredential;
  [ELocalDBStoreNames.Wallet]: RealmSchemaWallet;
  [ELocalDBStoreNames.Account]: RealmSchemaAccount;
  [ELocalDBStoreNames.AccountDerivation]: RealmSchemaAccountDerivation;
  [ELocalDBStoreNames.Device]: RealmSchemaDevice;
}

export interface IIndexedDBSchemaMap extends DBSchema {
  [ELocalDBStoreNames.AccountDerivation]: {
    key: string;
    value: DBAccountDerivation;
  };
  [ELocalDBStoreNames.Account]: {
    key: string;
    value: DBAccount;
    // indexes: { date: Date; title: string };
  };
  [ELocalDBStoreNames.Context]: {
    key: string;
    value: OneKeyContext;
  };
  [ELocalDBStoreNames.Credential]: {
    key: string;
    value: IDBCredentialBase;
  };
  [ELocalDBStoreNames.Device]: {
    key: string;
    value: DBDevice;
  };
  [ELocalDBStoreNames.Wallet]: {
    key: string;
    value: DBWallet;
  };
}

export type ILocalDBTransactionStores = {
  [ELocalDBStoreNames.Context]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Context[],
    ELocalDBStoreNames.Context,
    'readwrite'
  >;
  [ELocalDBStoreNames.Credential]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Credential[],
    ELocalDBStoreNames.Credential,
    'readwrite'
  >;
  [ELocalDBStoreNames.Wallet]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Wallet[],
    ELocalDBStoreNames.Wallet,
    'readwrite'
  >;
  [ELocalDBStoreNames.Account]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Account[],
    ELocalDBStoreNames.Account,
    'readwrite'
  >;
  [ELocalDBStoreNames.AccountDerivation]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.AccountDerivation[],
    ELocalDBStoreNames.AccountDerivation,
    'readwrite'
  >;
  [ELocalDBStoreNames.Device]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Device[],
    ELocalDBStoreNames.Device,
    'readwrite'
  >;
};
export interface ILocalDBTransaction {
  stores?: ILocalDBTransactionStores;
}

export type ILocalDBRecord<T extends ELocalDBStoreNames> = ILocalDBSchemaMap[T];

export type ILocalDBRecordPair<T extends ELocalDBStoreNames> = [
  ILocalDBRecord<T>,
  IRealmDBSchemaMap[T] | null,
];

export interface ILocalDBTxGetRecordByIdParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
  id: string;
}
export type ILocalDBTxGetRecordByIdResult<T extends ELocalDBStoreNames> =
  ILocalDBRecordPair<T>;

export interface ILocalDBGetRecordByIdParams<T extends ELocalDBStoreNames> {
  name: T;
  id: string;
}
export type ILocalDBGetRecordByIdResult<T extends ELocalDBStoreNames> =
  ILocalDBRecord<T>;

export interface ILocalDBTxGetAllRecordsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
}
export interface ILocalDBTxGetAllRecordsResult<T extends ELocalDBStoreNames> {
  recordPairs: ILocalDBRecordPair<T>[];
  records: ILocalDBRecord<T>[];
}

export interface ILocalDBGetAllRecordsParams<T extends ELocalDBStoreNames> {
  name: T;
}
export interface ILocalDBGetAllRecordsResult<T extends ELocalDBStoreNames> {
  records: ILocalDBRecord<T>[];
}

export interface ILocalDBTxUpdateRecordsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
  recordPairs?: ILocalDBRecordPair<T>[];
  ids?: string[];
  updater: ILocalDBRecordUpdater<T>;
}

export interface ILocalDBTxAddRecordsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
  records: ILocalDBRecord<T>[];
  skipIfExists?: boolean; // TODO skip
}

export interface ILocalDBTxRemoveRecordsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
  recordPairs?: ILocalDBRecordPair<T>[];
  ids?: string[];
}

export type ILocalDBRecordUpdater<T extends ELocalDBStoreNames> = <
  T1 extends ILocalDBRecord<T> | IRealmDBSchemaMap[T],
>(
  record: T1,
) => Promise<T1> | T1;

export type ILocalDBWithTransactionTask<T> = (
  tx: ILocalDBTransaction,
) => Promise<T>;

export interface ILocalDBAgent {
  withTransaction<T>(task: ILocalDBWithTransactionTask<T>): Promise<T>;

  // TODO get with query
  getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>>;

  getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>>;

  txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>>;

  txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>>;

  // TODO batch update/add/remove
  txUpdateRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxUpdateRecordsParams<T>,
  ): Promise<void>;

  txAddRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxAddRecordsParams<T>,
  ): Promise<void>;

  txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void>;
}

// ---------------------------------------------- test only
export type DBTestNewStore = HasName & {
  test: string;
};
