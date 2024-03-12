import type {
  IBip39RevealableSeed,
  IBip39RevealableSeedEncryptHex,
} from '@onekeyhq/core/src/secret';
import type {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import type { EDBAccountType, EDBCredentialType } from './consts';
import type { ELocalDBStoreNames } from './localDBStoreNames';
import type { RealmSchemaAccount } from './realm/schemas/RealmSchemaAccount';
import type { RealmSchemaAccountDerivation } from './realm/schemas/RealmSchemaAccountDerivation';
import type { RealmSchemaAddress } from './realm/schemas/RealmSchemaAddress';
import type { RealmSchemaContext } from './realm/schemas/RealmSchemaContext';
import type { RealmSchemaCredential } from './realm/schemas/RealmSchemaCredential';
import type { RealmSchemaDevice } from './realm/schemas/RealmSchemaDevice';
import type { RealmSchemaIndexedAccount } from './realm/schemas/RealmSchemaIndexedAccount';
import type { RealmSchemaWallet } from './realm/schemas/RealmSchemaWallet';
import type { SearchDevice } from '@onekeyfe/hd-core';
import type { DBSchema, IDBPObjectStore } from 'idb';

// ---------------------------------------------- base
export type IDBBaseObject = {
  id: string;
};
export type IDBBaseObjectWithName = IDBBaseObject & {
  name: string;
};
export type IDBContext = {
  id: string; // DB_MAIN_CONTEXT_ID
  nextHD: number;
  nextWalletNo: number;
  verifyString: string;
  networkOrderChanged?: boolean;
  backupUUID: string;
};
export type IDBApiGetContextOptions = {
  verifyPassword?: string;
};

// ---------------------------------------------- credential
export type IDBCredential = IDBBaseObject & {
  credential: string;
};
export type IDBPrivateKeyCredential = {
  type: EDBCredentialType.PRIVATE_KEY;
  privateKey: Buffer;
  password: string;
};
export type IDBStoredSeedCredential = {
  entropy: string;
  seed: string;
};
export type IDBStoredPrivateKeyCredential = {
  privateKey: string;
};
export type IDBStoredCredential =
  | IDBStoredSeedCredential
  | IDBStoredPrivateKeyCredential;
export type IDBExportedSeedCredential = IBip39RevealableSeed & {
  type: 'hd';
};
export type IDBExportedPrivateKeyCredential = {
  type: 'imported';
  privateKey: Buffer;
};
export type IDBExportedCredential =
  | IDBExportedSeedCredential
  | IDBExportedPrivateKeyCredential;
export type IDBCredentialBase = {
  id: string;
  // type: 'imported' | 'hd';
  credential: IBip39RevealableSeedEncryptHex;
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
export type IDBWallet = IDBBaseObjectWithName & {
  type: IDBWalletType;
  backuped: boolean;
  nextIndex: number; // TODO optional
  // only for singleton wallet
  accounts: Array<string>;
  // only for singleton wallet
  nextAccountIds: {
    // 'global': 1, // imported, external, watching,
    // purpose + cointype => index
    [template: string]: number; // hd
  };
  associatedDevice?: string; // alias to `dbDeviceId`
  avatar?: IDBAvatar;
  avatarInfo?: IAvatarInfo; // readonly field
  deviceType?: string;
  isTemp?: boolean;
  passphraseState?: string;
  walletNo: number;
  walletOrder?: number;
};
export type IDBCreateHDWalletParams = {
  password: string;
  rs: IBip39RevealableSeedEncryptHex;
  backuped: boolean;
  name?: string;
  avatar?: IAvatarInfo;
};
export type IDBCreateHWWalletParamsBase = {
  name?: string;
  device: SearchDevice;
  features: IOneKeyDeviceFeatures;
  isFirmwareVerified?: boolean;
  skipDeviceCancel?: boolean;
};
export type IDBCreateHWWalletParams = IDBCreateHWWalletParamsBase & {
  passphraseState?: string;
};
export type IDBSetWalletNameAndAvatarParams = {
  walletId: IDBWalletId;
  name?: string;
  avatar?: IAvatarInfo;
};
export type IDBRemoveWalletParams = {
  walletId: string;
  password: string;
  isHardware: boolean;
};
export type IDBSetAccountNameParams = {
  accountId?: string;
  indexedAccountId?: string;
  name: string;
};

// ---------------------------------------------- account
export type IDBAvatar = string; // stringify(IAvatarInfo)
// IAvatar;
// export type IDBAvatar = {
//   emoji: string | 'img'; // lazy load EmojiTypes
//   bgColor: string;
// };
export type IDBBaseAccount = IDBBaseObjectWithName & {
  type: EDBAccountType | undefined;
  path: string;
  pathIndex?: number;
  relPath?: string;
  indexedAccountId?: string;
  coinType: string;
  impl: string; // single chain account belongs to network impl
  networks?: string[]; // single chain account belongs to certain networks
  createAtNetwork?: string;
  template?: string;
};
export type IDBSimpleAccount = IDBBaseAccount & {
  pub: string;
  address: string;
};
export type IDBUtxoAccount = IDBBaseAccount & {
  pub?: string; // TODO rename pubKey to pub
  xpub: string;
  xpubSegwit?: string; // wrap regular xpub into bitcoind native descriptor
  address: string; // Display/selected address
  addresses: Record<string, string>;
  customAddresses?: Record<string, string>; // for btc custom address
};
export type IDBVariantAccount = IDBBaseAccount & {
  pub: string;
  address: string; // Base address
  // VARIANT: Network -> address
  // UTXO: relPath -> address
  addresses: Record<string, string>;
};
export type IDBAccount = IDBSimpleAccount | IDBUtxoAccount | IDBVariantAccount;
export type IDBIndexedAccount = IDBBaseObjectWithName & {
  walletId: string;
  index: number;
  idHash: string;
  associateAccount?: IDBAccount; // readonly
};
// TODO remove, use accountsMap instead, wallet->network->derivation(template)
export type IDBAccountDerivation = IDBBaseObject & {
  walletId: string;
  accounts: string[];
  template: string;
};
export type IDBSetAccountTemplateParams = {
  accountId: string;
  template: string;
};
export type IDBAddAccountDerivationParams = {
  walletId: string;
  accountId: string;
  impl: string;
  template: string;
  derivationStore?: IDBObjectStore;
};
export type IDBSetNextAccountIdsParams = {
  walletId: string;
  nextAccountIds: Record<string, number>;
};

// ---------------------------------------------- device
export type IDBDevicePayload = {
  onDeviceInputPin?: boolean;
};
export type IDBDevice = IDBBaseObjectWithName & {
  features: string;
  featuresInfo?: IOneKeyDeviceFeatures; // readonly field
  connectId: string; // alias mac\sn, never changed
  name: string;
  uuid: string;
  deviceId: string; // deviceId changed after device reset
  deviceType: string;
  payloadJson: string;
  payloadJsonInfo?: any;
  createdAt: number;
  updatedAt: number;
  verifiedAtVersion?: string;
};
export type IDBDevicePro = Omit<IDBDevice, 'payloadJson'> & {
  payload: IDBDevicePayload;
};

// ---------------------------------------------- address
export type IDBAddress = IDBBaseObject & {
  // id: networkId--address, impl--address
  wallets: Record<string, string>; // walletId -> indexedAccountId/accountId
};

// DB SCHEMA map ----------------------------------------------
export interface ILocalDBSchemaMap {
  [ELocalDBStoreNames.Context]: IDBContext;
  [ELocalDBStoreNames.Credential]: IDBCredentialBase;
  [ELocalDBStoreNames.Wallet]: IDBWallet;
  [ELocalDBStoreNames.Account]: IDBAccount;
  [ELocalDBStoreNames.AccountDerivation]: IDBAccountDerivation;
  [ELocalDBStoreNames.IndexedAccount]: IDBIndexedAccount;
  [ELocalDBStoreNames.Device]: IDBDevice;
  [ELocalDBStoreNames.Address]: IDBAddress;
}

export interface IRealmDBSchemaMap {
  [ELocalDBStoreNames.Context]: RealmSchemaContext;
  [ELocalDBStoreNames.Credential]: RealmSchemaCredential;
  [ELocalDBStoreNames.Wallet]: RealmSchemaWallet;
  [ELocalDBStoreNames.Account]: RealmSchemaAccount;
  [ELocalDBStoreNames.AccountDerivation]: RealmSchemaAccountDerivation;
  [ELocalDBStoreNames.IndexedAccount]: RealmSchemaIndexedAccount;
  [ELocalDBStoreNames.Device]: RealmSchemaDevice;
  [ELocalDBStoreNames.Address]: RealmSchemaAddress;
}

export interface IIndexedDBSchemaMap extends DBSchema {
  [ELocalDBStoreNames.AccountDerivation]: {
    key: string;
    value: IDBAccountDerivation;
  };
  [ELocalDBStoreNames.IndexedAccount]: {
    key: string;
    value: IDBIndexedAccount;
  };
  [ELocalDBStoreNames.Account]: {
    key: string;
    value: IDBAccount;
    // indexes: { date: Date; title: string };
  };
  [ELocalDBStoreNames.Context]: {
    key: string;
    value: IDBContext;
  };
  [ELocalDBStoreNames.Credential]: {
    key: string;
    value: IDBCredentialBase;
  };
  [ELocalDBStoreNames.Device]: {
    key: string;
    value: IDBDevice;
  };
  [ELocalDBStoreNames.Wallet]: {
    key: string;
    value: IDBWallet;
  };
  [ELocalDBStoreNames.Address]: {
    key: string;
    value: IDBAddress;
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
  [ELocalDBStoreNames.IndexedAccount]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.IndexedAccount[],
    ELocalDBStoreNames.IndexedAccount,
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
  [ELocalDBStoreNames.Address]: IDBPObjectStore<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Address[],
    ELocalDBStoreNames.Address,
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

// GetRecordsCount
export interface ILocalDBGetRecordsCountParams<T extends ELocalDBStoreNames> {
  name: T;
}
export interface ILocalDBTxGetRecordsCountParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
}
export interface ILocalDBGetRecordsCountResult {
  count: number;
}

// GetRecordById
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

// GetRecords
export type ILocalDBGetRecordsQuery = {
  ids?: string[];
};
export type ILocalDBTxGetAllRecordsParams<T extends ELocalDBStoreNames> = {
  tx: ILocalDBTransaction;
  name: T;
} & ILocalDBGetRecordsQuery;
export interface ILocalDBTxGetAllRecordsResult<T extends ELocalDBStoreNames> {
  recordPairs: ILocalDBRecordPair<T>[];
  records: ILocalDBRecord<T>[];
}

export type ILocalDBGetAllRecordsParams<T extends ELocalDBStoreNames> = {
  name: T;
} & ILocalDBGetRecordsQuery;
export interface ILocalDBGetAllRecordsResult<T extends ELocalDBStoreNames> {
  records: ILocalDBRecord<T>[];
}

// UpdateRecords
export interface ILocalDBTxUpdateRecordsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
  recordPairs?: ILocalDBRecordPair<T>[];
  ids?: string[];
  updater: ILocalDBRecordUpdater<T>;
}

// AddRecords
export interface ILocalDBTxAddRecordsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
  records: ILocalDBRecord<T>[];
  skipIfExists?: boolean; // TODO skip
}
export interface ILocalDBTxAddRecordsResult {
  added: number;
  addedIds: string[];
  skipped: number;
}

// RemoveRecords

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
export type ILocalDBWithTransactionOptions = {
  readOnly?: boolean;
};

export interface ILocalDBAgent {
  withTransaction<T>(
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
  ): Promise<T>;

  getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult>;

  // TODO get with query
  getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>>;

  getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>>;

  txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult>;

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
  ): Promise<ILocalDBTxAddRecordsResult>;

  txRemoveRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxRemoveRecordsParams<T>,
  ): Promise<void>;
}

// ---------------------------------------------- test only
export type IDBTestNewStore = IDBBaseObjectWithName & {
  test: string;
};
