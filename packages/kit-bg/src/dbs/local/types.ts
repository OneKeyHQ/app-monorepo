import type {
  IBip39RevealableSeed,
  IBip39RevealableSeedEncryptHex,
} from '@onekeyhq/core/src/secret';
import type {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_HD,
  WALLET_TYPE_HW,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_QR,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import type { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import type {
  IndexedDBObjectStorePromised,
  IndexedDBPromised,
} from '@onekeyhq/shared/src/IndexedDBPromised';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import type { EHardwareTransportType } from '@onekeyhq/shared/types';
import type {
  INetworkAccount,
  IQrWalletAirGapAccount,
  IQrWalletAirGapAccountsInfo,
} from '@onekeyhq/shared/types/account';
import type {
  IDeviceHomeScreen,
  IOneKeyDeviceFeatures,
  IQrWalletDevice,
} from '@onekeyhq/shared/types/device';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';
import type { ICloudSyncRawDataJson } from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';
import type {
  IBaseConnectedSite,
  IBaseCreatedAt,
  IBaseSignedMessage,
  IBaseSignedTransaction,
  IBaseSignedTransactionDataStringify,
} from '@onekeyhq/shared/types/signatureRecord';

import type { EDBAccountType, EDBCredentialType } from './consts';
import type { ELocalDBStoreNames } from './localDBStoreNames';
import type { RealmSchemaAccount } from './realm/schemas/RealmSchemaAccount';
import type { RealmSchemaAccountDerivation } from './realm/schemas/RealmSchemaAccountDerivation';
import type { RealmSchemaAddress } from './realm/schemas/RealmSchemaAddress';
import type { RealmSchemaCloudSyncItem } from './realm/schemas/RealmSchemaCloudSyncItem';
import type { RealmSchemaContext } from './realm/schemas/RealmSchemaContext';
import type { RealmSchemaCredential } from './realm/schemas/RealmSchemaCredential';
import type { RealmSchemaDevice } from './realm/schemas/RealmSchemaDevice';
import type { RealmSchemaHardwareHomeScreen } from './realm/schemas/RealmSchemaHardwareHomeScreen';
import type { RealmSchemaIndexedAccount } from './realm/schemas/RealmSchemaIndexedAccount';
import type { RealmSchemaWallet } from './realm/schemas/RealmSchemaWallet';
import type { IDeviceType, SearchDevice } from '@onekeyfe/hd-core';
import type { DBSchema } from 'idb';

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
  backupUUID: string; // deprecated
  nextSignatureMessageId: number;
  nextSignatureTransactionId: number;
  nextConnectedSiteId: number;
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
  | typeof WALLET_TYPE_QR
  | typeof WALLET_TYPE_IMPORTED
  | typeof WALLET_TYPE_WATCHING
  | typeof WALLET_TYPE_EXTERNAL;
export type IDBWalletNextIdKeys =
  | 'accountHdIndex'
  | 'accountGlobalNum'
  | 'hiddenWalletNum';
export type IDBWalletNextIds = Partial<Record<IDBWalletNextIdKeys, number>>;
export type IDBWallet = IDBBaseObjectWithName & {
  type: IDBWalletType;
  backuped: boolean;
  // only for singleton wallet
  accounts: string[];
  // only for singleton wallet
  // nextAccountIds: {
  //   // 'global': 1, // imported, external, watching,
  //   // 'index': 0, // hd, hw
  //   // purpose + cointype => index
  //   // [template: string]: number; // hd
  // };
  nextIds: IDBWalletNextIds;
  associatedDevice?: string; // alias to `dbDeviceId`
  associatedDeviceInfo?: IDBDevice; // readonly field
  avatar?: IDBAvatar;
  avatarInfo?: IAvatarInfo; // readonly field
  hiddenWallets?: IDBWallet[]; // readonly field
  dbAccounts?: IDBAccount[]; // readonly field
  dbIndexedAccounts?: IDBIndexedAccount[]; // readonly field
  isTemp?: boolean;
  isMocked?: boolean;
  passphraseState?: string;
  walletNo: number;
  walletOrderSaved?: number; // db field
  walletOrder?: number; // readonly field
  firstEvmAddress?: string;
  hash?: string; // hd wallet only ( hashed mnemonic )
  xfp?: string; // shortXfp--firstTaprootXpub
  airGapAccountsInfoRaw?: string;
  airGapAccountsInfo?: IQrWalletAirGapAccountsInfo;
  deprecated?: boolean; // hw wallet only
};
export type IDBCreateHDWalletParams = {
  password: string;
  rs: IBip39RevealableSeedEncryptHex;
  backuped: boolean;
  name?: string;
  walletHash: string;
  walletXfp: string;
  avatar?: IAvatarInfo;
};
export type IDBCreateHwWalletParamsBase = {
  name?: string;
  device: SearchDevice;
  features: IOneKeyDeviceFeatures;
  isFirmwareVerified?: boolean;
  skipDeviceCancel?: boolean;
  hideCheckingDeviceLoading?: boolean;
  defaultIsTemp?: boolean;
  isMockedStandardHwWallet?: boolean;
  isAttachPinMode?: boolean;
};
export type IDBCreateHwWalletParams = IDBCreateHwWalletParamsBase & {
  passphraseState?: string;
  xfp?: string;
  getFirstEvmAddressFn?: () => Promise<string | null>;
  fillingXfpByCallingSdk?: boolean;
  transportType?: EHardwareTransportType; // Transport type used for this connection
};

export type IDBCreateQRWalletParams = {
  qrDevice: IQrWalletDevice;
  airGapAccounts: IQrWalletAirGapAccount[];
  fullXfp?: string;
  isMockedStandardHwWallet?: boolean;
  existingDeviceId?: string;
};
export type IDBSetWalletNameAndAvatarParams = {
  walletId: IDBWalletId;
  name?: string;
  avatar?: IAvatarInfo;
  shouldCheckDuplicate?: boolean;
  skipSaveLocalSyncItem?: boolean; // avoid infinite loop sync
  skipEmitEvent?: boolean;
};
export type IDBRemoveWalletParams = {
  walletId: string;
  skipBackupWalletRemove?: boolean;
  isRemoveToMocked?: boolean; // hw standard wallet mocked remove only
};
type IDBSetAccountNameParamsBase = {
  shouldCheckDuplicate?: boolean;
  skipEventEmit?: boolean;
  skipSaveLocalSyncItem?: boolean; // avoid infinite loop sync
};
export type IDBSetAccountNameParams = IDBSetAccountNameParamsBase & {
  accountId?: string;
  indexedAccountId?: string;
  name: string;
};
export type IDBSetUniversalIndexedAccountNameParams =
  IDBSetAccountNameParamsBase & {
    indexedAccountId: string | undefined;
    index: number;
    walletXfp: string | undefined;
    name: string;
  };
export type IDBEnsureAccountNameNotDuplicateParams = {
  selfAccountOrIndexedAccountId?: string;
  walletId: string;
  name: string;
};
export type IDBGetWalletsParams = {
  nestedHiddenWallets?: boolean | undefined;
  ignoreEmptySingletonWalletAccounts?: boolean | undefined;
  ignoreNonBackedUpWallets?: boolean | undefined;
  includingAccounts?: boolean | undefined;

  allIndexedAccounts?: IDBIndexedAccount[] | undefined;
  allWallets?: IDBWallet[] | undefined;
  allDevices?: IDBDevice[] | undefined;
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
  relPath?: string; // 0/0
  indexedAccountId?: string;
  coinType: string;
  impl: string; // single chain account belongs to network impl
  // single chain account belongs to certain networks, check keyring options: onlyAvailableOnCertainNetworks
  networks?: string[]; // onlyAvailableOnCertainNetworks
  // single chain account auto change to createAtNetwork when network not compatible and networks not defined
  createAtNetwork?: string;
  template?: string;

  accountOrder?: number; // readonly field
  accountOrderSaved?: number; // db field
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
  // eslint-disable-next-line spellcheck/spell-checker
  addresses: Record<string, string>; // { "0/0": "xxxx" }
  customAddresses?: Record<string, string>; // for btc dynamic custom address
};
export type IDBVariantAccount = IDBBaseAccount & {
  pub: string;
  address: string; // Base address
  // VARIANT: networkId -> address
  // UTXO: relPath -> address
  addresses: Record<string, string>;
};
export type IDBAccountAddressesMap = {
  [networkIdOrImpl: string]: string; // multiple address join(',')
};
export type IDBExternalAccount = IDBVariantAccount & {
  address: string; // always be empty if walletconnect account

  connectionInfoRaw: string | undefined;
  connectionInfo?: IExternalConnectionInfo; // readonly field, json parse from connectionInfoRaw

  // TODO merge with addresses
  connectedAddresses: {
    [networkIdOrImpl: string]: string; // multiple address join(',')
  };
  selectedAddress: {
    [networkId: string]: number;
  };
};
export type IDBAccount =
  | IDBSimpleAccount
  | IDBUtxoAccount
  | IDBVariantAccount
  | IDBExternalAccount;
export type IDBIndexedAccount = IDBBaseObjectWithName & {
  walletId: string;
  index: number;
  idHash: string;
  associateAccount?: INetworkAccount; // readonly
  orderSaved?: number; // db field
  order?: number; // readonly
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

// ---------------------------------------------- device
export type IDBDeviceSettings = {
  inputPinOnSoftware?: boolean;
  inputPinOnSoftwareSupport?: boolean;
};
export type IDBDevice = IDBBaseObjectWithName & {
  features: string; // TODO rename to featuresRaw
  featuresInfo?: IOneKeyDeviceFeatures; // readonly field // TODO rename to features
  // TODO make index for better performance (getDeviceByQuery)
  connectId: string; // alias BLE mac or USB sn, never changed even if device reset
  name: string;
  // TODO make index for better performance (getDeviceByQuery)
  uuid: string;
  deviceId: string; // features.device_id changed after device reset, use deviceUtils.getRawDeviceId()
  deviceType: IDeviceType;
  settingsRaw: string;
  settings?: IDBDeviceSettings;
  createdAt: number;
  updatedAt: number;
  verifiedAtVersion?: string;

  // New fields for USB/BLE connection support
  usbConnectId?: string; // USB connection ID (serial number)
  bleConnectId?: string; // BLE connection ID (MAC address)
};
export type IDBUpdateDeviceSettingsParams = {
  dbDeviceId: string;
  settings: IDBDeviceSettings;
};
export type IDBUpdateFirmwareVerifiedParams = {
  device: IDBDevice;
  verifyResult: 'official' | 'unofficial' | 'unknown';
};
// ---------------------------------------------- address
export type IDBAddress = IDBBaseObject & {
  // id: networkId--address, impl--address
  wallets: Record<string, string>; // walletId -> indexedAccountId/accountId
};

export type IDBSignedMessage = IDBBaseObject &
  IBaseSignedMessage &
  IBaseCreatedAt;
export type IDBSignedTransaction = IDBBaseObject &
  IBaseSignedTransaction &
  IBaseSignedTransactionDataStringify &
  IBaseCreatedAt;

export type IDBConnectedSite = IDBBaseObject &
  IBaseConnectedSite &
  IBaseCreatedAt;

export type IDBHardwareHomeScreen = IDBBaseObject &
  IDeviceHomeScreen &
  IBaseCreatedAt;

// ---------------------------------------------- prime cloud sync
export type IDBCloudSyncItem = IDBBaseObject & {
  // key: string; use id as key
  rawKey: string;
  rawData: string | undefined;
  dataType: EPrimeCloudSyncDataType;
  data: string | undefined;
  dataTime: number | undefined;
  isDeleted: boolean;

  pwdHash: string;

  localSceneUpdated: boolean;
  serverUploaded: boolean;

  // runtime readonly field ----------------------------------------------
  rawDataJson?: ICloudSyncRawDataJson;
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
  [ELocalDBStoreNames.SignedMessage]: IDBSignedMessage;
  [ELocalDBStoreNames.SignedTransaction]: IDBSignedTransaction;
  [ELocalDBStoreNames.ConnectedSite]: IDBConnectedSite;
  [ELocalDBStoreNames.CloudSyncItem]: IDBCloudSyncItem;
  [ELocalDBStoreNames.HardwareHomeScreen]: IDBHardwareHomeScreen;
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
  [ELocalDBStoreNames.SignedMessage]: IDBSignedMessage;
  [ELocalDBStoreNames.SignedTransaction]: IDBSignedTransaction;
  [ELocalDBStoreNames.ConnectedSite]: IDBConnectedSite;
  [ELocalDBStoreNames.CloudSyncItem]: RealmSchemaCloudSyncItem;
  [ELocalDBStoreNames.HardwareHomeScreen]: RealmSchemaHardwareHomeScreen;
}

export type IIndexedBucketsMap = Record<
  EIndexedDBBucketNames,
  IndexedDBPromised<IIndexedDBSchemaMap>
>;
export const INDEXED_BUCKET_NAME_BACKUP_PREFIX = 'backup-';
export enum EIndexedDBBucketNames {
  // default = 'default',
  // credential = 'credential', // credential, context
  // wallet = 'wallet', // wallet, device
  account = 'account_local-db_onekey-bucket', // account
  backupAccount = `${INDEXED_BUCKET_NAME_BACKUP_PREFIX}account_local-db_onekey-bucket`, // account
  address = 'address_local-db_onekey-bucket', // address to account map
  archive = 'archive_local-db_onekey-bucket', // connected site, signed message, signed transaction

  // using independent cloudsync bucket will cause transaction nesting, causing one of the transactions to terminate automatically, so it is still necessary to share the same bucket with account
  // cloudSync = 'cloud-sync_local-db_onekey-bucket', // cloud sync
  // misc = 'misc', // misc
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
  [ELocalDBStoreNames.SignedMessage]: {
    key: string;
    value: IDBSignedMessage;
    indexes: { createdAt: number };
  };
  [ELocalDBStoreNames.SignedTransaction]: {
    key: string;
    value: IDBSignedTransaction;
  };
  [ELocalDBStoreNames.ConnectedSite]: {
    key: string;
    value: IDBConnectedSite;
  };
  [ELocalDBStoreNames.CloudSyncItem]: {
    key: string;
    value: IDBCloudSyncItem;
  };
  [ELocalDBStoreNames.HardwareHomeScreen]: {
    key: string;
    value: IDBHardwareHomeScreen;
  };
}

export type ILocalDBTransactionStores = {
  [ELocalDBStoreNames.Context]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Context[],
    ELocalDBStoreNames.Context,
    'readwrite'
  >;
  [ELocalDBStoreNames.Credential]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Credential[],
    ELocalDBStoreNames.Credential,
    'readwrite'
  >;
  [ELocalDBStoreNames.Wallet]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Wallet[],
    ELocalDBStoreNames.Wallet,
    'readwrite'
  >;
  [ELocalDBStoreNames.Account]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Account[],
    ELocalDBStoreNames.Account,
    'readwrite'
  >;
  [ELocalDBStoreNames.IndexedAccount]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.IndexedAccount[],
    ELocalDBStoreNames.IndexedAccount,
    'readwrite'
  >;
  [ELocalDBStoreNames.AccountDerivation]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.AccountDerivation[],
    ELocalDBStoreNames.AccountDerivation,
    'readwrite'
  >;
  [ELocalDBStoreNames.Device]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Device[],
    ELocalDBStoreNames.Device,
    'readwrite'
  >;
  [ELocalDBStoreNames.Address]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.Address[],
    ELocalDBStoreNames.Address,
    'readwrite'
  >;
  [ELocalDBStoreNames.SignedMessage]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.SignedMessage[],
    ELocalDBStoreNames.SignedMessage,
    'readwrite'
  >;
  [ELocalDBStoreNames.SignedTransaction]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.SignedTransaction[],
    ELocalDBStoreNames.SignedTransaction,
    'readwrite'
  >;
  [ELocalDBStoreNames.ConnectedSite]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.ConnectedSite[],
    ELocalDBStoreNames.ConnectedSite,
    'readwrite'
  >;
  [ELocalDBStoreNames.CloudSyncItem]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.CloudSyncItem[],
    ELocalDBStoreNames.CloudSyncItem,
    'readwrite'
  >;
  [ELocalDBStoreNames.HardwareHomeScreen]: IndexedDBObjectStorePromised<
    IIndexedDBSchemaMap,
    ELocalDBStoreNames.HardwareHomeScreen[],
    ELocalDBStoreNames.HardwareHomeScreen,
    'readwrite'
  >;
};

// TODO generic type of bucketName
export interface ILocalDBTransaction {
  stores?: ILocalDBTransactionStores;
  bucketName: EIndexedDBBucketNames;
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

// GetRecordIds
export interface ILocalDBGetRecordIdsParams<T extends ELocalDBStoreNames> {
  name: T;
}
export type ILocalDBGetRecordIdsResult = string[];

// GetRecords
export type ILocalDBGetRecordsQuery = {
  limit?: number;
  offset?: number;
};
export type ILocalDBTxGetAllRecordsParams<T extends ELocalDBStoreNames> = {
  tx: ILocalDBTransaction;
  name: T;
} & ILocalDBGetRecordsQuery;
export interface ILocalDBTxGetAllRecordsResult<T extends ELocalDBStoreNames> {
  recordPairs: Array<ILocalDBRecordPair<T>>;
  records: Array<ILocalDBRecord<T>>;
}

export type ILocalDBGetAllRecordsParams<T extends ELocalDBStoreNames> = {
  name: T;
} & ILocalDBGetRecordsQuery;
export interface ILocalDBGetAllRecordsResult<T extends ELocalDBStoreNames> {
  records: Array<ILocalDBRecord<T>>;
  // recordPairs is only available of txGetAllRecords()
}

export type ILocalDBGetRecordsByIdsQuery = {
  ids: string[];
};
export type ILocalDBTxGetRecordsByIdsParams<T extends ELocalDBStoreNames> = {
  tx: ILocalDBTransaction;
  name: T;
} & ILocalDBGetRecordsByIdsQuery;
export interface ILocalDBTxGetRecordsByIdsResult<T extends ELocalDBStoreNames> {
  recordPairs: Array<ILocalDBRecordPair<T> | null | undefined>;
  records: Array<ILocalDBRecord<T> | null | undefined>;
}

export type ILocalDBGetRecordsByIdsParams<T extends ELocalDBStoreNames> = {
  name: T;
} & ILocalDBGetRecordsByIdsQuery;
export interface ILocalDBGetRecordsByIdsResult<T extends ELocalDBStoreNames> {
  records: Array<ILocalDBRecord<T> | null | undefined>;
  // recordPairs is only available of txGetAllRecords()
}

// GetRecordIds
export interface ILocalDBTxGetRecordIdsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
}
export type ILocalDBTxGetRecordIdsResult = string[];

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
export interface ILocalDBRemoveRecordsParams<T extends ELocalDBStoreNames> {
  name: T;
  recordPairs?: ILocalDBRecordPair<T>[];
  ids?: string[];
  ignoreNotFound?: boolean;
}
export interface ILocalDBTxRemoveRecordsParams<T extends ELocalDBStoreNames> {
  tx: ILocalDBTransaction;
  name: T;
  recordPairs?: ILocalDBRecordPair<T>[];
  ids?: string[];
  ignoreNotFound?: boolean;
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
    bucketName: EIndexedDBBucketNames,
    task: ILocalDBWithTransactionTask<T>,
    options?: ILocalDBWithTransactionOptions,
  ): Promise<T>;

  clearRecords(params: { name: ELocalDBStoreNames }): Promise<void>;

  getRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult>;

  // TODO get with query
  getAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBGetAllRecordsParams<T>,
  ): Promise<ILocalDBGetAllRecordsResult<T>>;

  getRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBGetRecordsByIdsResult<T>>;

  getRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordByIdParams<T>,
  ): Promise<ILocalDBGetRecordByIdResult<T>>;

  getRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult>;

  txGetRecordsCount<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsCountParams<T>,
  ): Promise<ILocalDBGetRecordsCountResult>;

  txGetAllRecords<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetAllRecordsParams<T>,
  ): Promise<ILocalDBTxGetAllRecordsResult<T>>;

  txGetRecordsByIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordsByIdsParams<T>,
  ): Promise<ILocalDBTxGetRecordsByIdsResult<T>>;

  txGetRecordById<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordByIdParams<T>,
  ): Promise<ILocalDBTxGetRecordByIdResult<T>>;

  txGetRecordIds<T extends ELocalDBStoreNames>(
    params: ILocalDBTxGetRecordIdsParams<T>,
  ): Promise<ILocalDBGetRecordIdsResult>;

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
