import type { IAddressItem } from '@onekeyhq/kit/src/views/AddressBook/type';
import type { IBrowserBookmark } from '@onekeyhq/kit/src/views/Discovery/types';
import type {
  IDBAccount,
  IDBCloudSyncItem,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
  IDBWalletType,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

import type { IServerNetwork } from '..';
import type { EPrimeCloudSyncDataType } from '../../src/consts/primeConsts';
import type { IAvatarInfo } from '../../src/utils/emojiUtils';
import type { IDBCustomRpc } from '../customRpc';
import type { IMarketWatchListItem } from '../market';
import type { ICloudSyncCustomToken } from '../token';

// for user to manual resolve diff items
export type ICloudSyncServerDiffItem = {
  serverToLocalItem: IDBCloudSyncItem;
  localItem: IDBCloudSyncItem | undefined;
  serverPayload:
    | ICloudSyncPayloadLock
    | ICloudSyncPayloadWallet
    | ICloudSyncPayloadAccount
    | ICloudSyncPayloadIndexedAccount
    | ICloudSyncPayloadBrowserBookmark
    | ICloudSyncPayloadMarketWatchList
    | ICloudSyncPayloadCustomRpc
    | ICloudSyncPayloadCustomToken
    | ICloudSyncPayloadCustomNetwork
    | ICloudSyncPayloadAddressBook
    | undefined;
  record:
    | IDBWallet
    | IDBAccount
    | IDBIndexedAccount
    | IBrowserBookmark
    | IMarketWatchListItem
    | IDBCustomRpc
    | IServerNetwork
    | IAddressItem
    | ICloudSyncCustomToken // CustomToken
    | undefined;
};

export type IStartServerSyncFlowParams = {
  isFlush?: boolean;
  encryptedSecurityPasswordR1ForServer?: string;
  setUndefinedTimeToNow?: boolean;
  throwError?: boolean;
  callerName?: string;
};

export type ICloudSyncServerItem = {
  data: string;
  dataTimestamp: number | undefined;
  dataType: EPrimeCloudSyncDataType;
  isDeleted: boolean;
  pwdHash: string; // TODO server should return pwdHash
  key: string;
  // nonce: number;
  // userId: string; privy user id
};
export type ICloudSyncServerItemByDownloaded = {
  data: string;
  dataTimestamp: number;
  dataType: EPrimeCloudSyncDataType;
  isDeleted: boolean;
  pwdHash: string;
  key: string;
  // nonce: number; // TODO remove
  // pwdHash: string;
  // pwdTimestamp: number;
  // createdAt: string;
  // updatedAt: string;
  // userId: string;
};
export type ICloudSyncCredential = {
  primeAccountSalt: string;
  securityPasswordR1: string;
  masterPasswordUUID: string; // pwdHash
};
export type ICloudSyncCredentialForLock = Omit<
  ICloudSyncCredential,
  'securityPasswordR1'
> & {
  securityPasswordR1: 'lock';
};
export type ICloudSyncDBRecord =
  | IDBWallet
  | IDBAccount
  | IDBIndexedAccount
  | IBrowserBookmark
  | IMarketWatchListItem
  | IDBCustomRpc
  | IServerNetwork // CustomNetwork
  | IAddressItem
  | ICloudSyncCustomToken; // CustomToken
export type ICloudSyncDBRecords =
  | IDBWallet[]
  | IDBAccount[]
  | IDBIndexedAccount[]
  | IBrowserBookmark[]
  | IMarketWatchListItem[]
  | IDBCustomRpc[]
  | IServerNetwork[] // CustomNetwork
  | IAddressItem[]
  | ICloudSyncCustomToken[]; // CustomToken

// sync target --------------------------------

export type ICloudSyncTargetBase = {
  targetId: string; // walletId, indexedAccountId, accountId, bookmarkUrl
};
export type ICloudSyncTargetWallet = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.Wallet;
  wallet: IDBWallet & ICloudSyncPayloadDbWalletFields;
  dbDevice: IDBDevice | undefined;
};

export type ICloudSyncTargetIndexedAccount = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.IndexedAccount;
  indexedAccount: IDBIndexedAccount & { name: string; index: number };
  wallet: (IDBWallet & ICloudSyncPayloadDbWalletFields) | undefined;
  // dbDevice: IDBDevice | undefined;
};

export type ICloudSyncTargetAccount = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.Account;
  account: IDBAccount & { name: string };
};

export type ICloudSyncTargetLock = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.Lock;
  targetId: 'lock';
  encryptedSecurityPasswordR1ForServer: string;
};

export type ICloudSyncTargetBrowserBookmark = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.BrowserBookmark;
  bookmark: IBrowserBookmark;
};

export type ICloudSyncTargetMarketWatchList = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.MarketWatchList;
  watchListItem: IMarketWatchListItem;
};

export type ICloudSyncTargetCustomRpc = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.CustomRpc;
  customRpc: IDBCustomRpc;
};

export type ICloudSyncTargetCustomToken = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.CustomToken;
  customToken: ICloudSyncCustomToken;
};

export type ICloudSyncTargetCustomNetwork = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.CustomNetwork;
  customNetwork: IServerNetwork;
  customRpc: IDBCustomRpc;
};

export type ICloudSyncTargetAddressBook = ICloudSyncTargetBase & {
  dataType: EPrimeCloudSyncDataType.AddressBook;
  addressBookItem: IAddressItem;
};

export interface ICloudSyncTargetMap {
  [EPrimeCloudSyncDataType.Wallet]: ICloudSyncTargetWallet;
  [EPrimeCloudSyncDataType.Account]: ICloudSyncTargetAccount;
  [EPrimeCloudSyncDataType.IndexedAccount]: ICloudSyncTargetIndexedAccount;
  [EPrimeCloudSyncDataType.Lock]: ICloudSyncTargetLock;
  [EPrimeCloudSyncDataType.BrowserBookmark]: ICloudSyncTargetBrowserBookmark;
  [EPrimeCloudSyncDataType.MarketWatchList]: ICloudSyncTargetMarketWatchList;
  [EPrimeCloudSyncDataType.AddressBook]: ICloudSyncTargetAddressBook;
  [EPrimeCloudSyncDataType.CustomRpc]: ICloudSyncTargetCustomRpc;
  [EPrimeCloudSyncDataType.CustomToken]: ICloudSyncTargetCustomToken;
  [EPrimeCloudSyncDataType.CustomNetwork]: ICloudSyncTargetCustomNetwork;
}

// key info --------------------------------
type ICloudSyncKeyInfoBase = {
  key: string;
  rawKey: string;
};
export type ICloudSyncKeyInfoWallet = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.Wallet;
  payload: ICloudSyncPayloadWallet;
  // walletType: IDBWalletType;
  // walletHash: string | undefined;
  // hwDeviceId: string | undefined;
};
export type ICloudSyncKeyInfoAccount = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.Account;
  payload: ICloudSyncPayloadAccount;
};
export type ICloudSyncKeyInfoIndexedAccount = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.IndexedAccount;
  payload: ICloudSyncPayloadIndexedAccount;
};
export type ICloudSyncKeyInfoLock = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.Lock;
  payload: ICloudSyncPayloadLock;
};

export type ICloudSyncKeyInfoBrowserBookmark = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.BrowserBookmark;
  payload: ICloudSyncPayloadBrowserBookmark;
};

export type ICloudSyncKeyInfoMarketWatchList = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.MarketWatchList;
  payload: ICloudSyncPayloadMarketWatchList;
};

export type ICloudSyncKeyInfoCustomRpc = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.CustomRpc;
  payload: ICloudSyncPayloadCustomRpc;
};

export type ICloudSyncKeyInfoCustomToken = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.CustomToken;
  payload: ICloudSyncPayloadCustomToken;
};

export type ICloudSyncKeyInfoCustomNetwork = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.CustomNetwork;
  payload: ICloudSyncPayloadCustomNetwork;
};

export type ICloudSyncKeyInfoAddressBook = ICloudSyncKeyInfoBase & {
  dataType: EPrimeCloudSyncDataType.AddressBook;
  payload: ICloudSyncPayloadAddressBook;
};

export interface ICloudSyncKeyInfoMap {
  [EPrimeCloudSyncDataType.Wallet]: ICloudSyncKeyInfoWallet;
  [EPrimeCloudSyncDataType.Account]: ICloudSyncKeyInfoAccount;
  [EPrimeCloudSyncDataType.IndexedAccount]: ICloudSyncKeyInfoIndexedAccount;
  [EPrimeCloudSyncDataType.Lock]: ICloudSyncKeyInfoLock;
  [EPrimeCloudSyncDataType.BrowserBookmark]: ICloudSyncKeyInfoBrowserBookmark;
  [EPrimeCloudSyncDataType.MarketWatchList]: ICloudSyncKeyInfoMarketWatchList;
  [EPrimeCloudSyncDataType.AddressBook]: ICloudSyncKeyInfoAddressBook;
  [EPrimeCloudSyncDataType.CustomRpc]: ICloudSyncKeyInfoCustomRpc;
  [EPrimeCloudSyncDataType.CustomToken]: ICloudSyncKeyInfoCustomToken;
  [EPrimeCloudSyncDataType.CustomNetwork]: ICloudSyncKeyInfoCustomNetwork;
}

// payload --------------------------------
export type ICloudSyncPayloadDbWalletFields = {
  name: string;
  avatarInfo: IAvatarInfo | undefined;
};
export type ICloudSyncPayloadWallet = {
  name: string;
  avatar: IAvatarInfo | undefined;
  //
  walletHash: string | undefined; // hd wallet only ( hashed mnemonic )
  hwDeviceId: string | undefined;
  passphraseState: string | undefined;
  walletType: IDBWalletType | undefined;
};
export type ICloudSyncPayloadAccount = {
  name: string;
  accountId: string;
};
export type ICloudSyncPayloadIndexedAccount = {
  name: string;
  index: number;
  walletXfp: string;
  //
  // walletHash: string | undefined;
  // hwDeviceId: string | undefined;
  // passphraseState: string | undefined;
  // walletType: IDBWalletType | undefined;
};
export type ICloudSyncPayloadLock = {
  message: 'lock';
  encryptedSecurityPasswordR1ForServer: string;
};

export type ICloudSyncPayloadBrowserBookmark = IBrowserBookmark;

export type ICloudSyncPayloadMarketWatchList = IMarketWatchListItem;

export type ICloudSyncPayloadCustomRpc = IDBCustomRpc;

export type ICloudSyncPayloadCustomToken = {
  customToken: ICloudSyncCustomToken;
};

export type ICloudSyncPayloadCustomNetwork = {
  customNetwork: IServerNetwork;
  customRpc: IDBCustomRpc;
};

export type ICloudSyncPayloadAddressBook = {
  networkImpl: string;
  addressBookItem: IAddressItem & {
    id: ''; // id is local uuid, should not be sync
  };
};

export type ICloudSyncPayload =
  | ICloudSyncPayloadWallet
  | ICloudSyncPayloadAccount
  | ICloudSyncPayloadIndexedAccount
  | ICloudSyncPayloadLock
  | ICloudSyncPayloadBrowserBookmark
  | ICloudSyncPayloadMarketWatchList
  | ICloudSyncPayloadAddressBook
  | ICloudSyncPayloadCustomRpc
  | ICloudSyncPayloadCustomToken
  | ICloudSyncPayloadCustomNetwork;

export interface ICloudSyncPayloadMap {
  [EPrimeCloudSyncDataType.Wallet]: ICloudSyncPayloadWallet;
  [EPrimeCloudSyncDataType.Account]: ICloudSyncPayloadAccount;
  [EPrimeCloudSyncDataType.IndexedAccount]: ICloudSyncPayloadIndexedAccount;
  [EPrimeCloudSyncDataType.Lock]: ICloudSyncPayloadLock;
  [EPrimeCloudSyncDataType.BrowserBookmark]: ICloudSyncPayloadBrowserBookmark;
  [EPrimeCloudSyncDataType.MarketWatchList]: ICloudSyncPayloadMarketWatchList;
  [EPrimeCloudSyncDataType.AddressBook]: ICloudSyncPayloadAddressBook;
  [EPrimeCloudSyncDataType.CustomRpc]: ICloudSyncPayloadCustomRpc;
  [EPrimeCloudSyncDataType.CustomToken]: ICloudSyncPayloadCustomToken;
  [EPrimeCloudSyncDataType.CustomNetwork]: ICloudSyncPayloadCustomNetwork;
}

export type IExistingSyncItemsInfo<T extends EPrimeCloudSyncDataType> = {
  [targetId: string]: {
    syncItem: IDBCloudSyncItem;
    syncPayload: ICloudSyncPayloadMap[T];
    target: ICloudSyncTargetMap[T];
  };
};

type ICloudSyncRawDataJsonBase = { rawKey: string };
// TODO use ICloudSyncPayloadMap instead
export type ICloudSyncRawDataJson =
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.Wallet;
      payload: ICloudSyncPayloadWallet;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.Account;
      payload: ICloudSyncPayloadAccount;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.IndexedAccount;
      payload: ICloudSyncPayloadIndexedAccount;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.Lock;
      payload: ICloudSyncPayloadLock;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.BrowserBookmark;
      payload: ICloudSyncPayloadBrowserBookmark;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.MarketWatchList;
      payload: ICloudSyncPayloadMarketWatchList;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.AddressBook;
      payload: ICloudSyncPayloadAddressBook;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.CustomRpc;
      payload: ICloudSyncPayloadCustomRpc;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.CustomToken;
      payload: ICloudSyncPayloadCustomToken;
    })
  | (ICloudSyncRawDataJsonBase & {
      dataType: EPrimeCloudSyncDataType.CustomNetwork;
      payload: ICloudSyncPayloadCustomNetwork;
    });
