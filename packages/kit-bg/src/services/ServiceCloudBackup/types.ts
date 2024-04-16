// import type { ISimpleDbEntityMarktData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityMarket';
// import type { ISimpleDbEntityUtxoData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { IBrowserBookmark } from '@onekeyhq/kit/src/views/Discovery/types';

import type { IHdWalletAvatarImageNames } from '@onekeyhq/shared/src/utils/avatarUtils';

import type {
  IDBAccount,
  IDBCreateHWWalletParamsBase,
  IDBIndexedAccount,
  IDBWallet,
  IDBWalletIdSingleton,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

// export type ISimpleDBBackUp = {
//   utxoAccounts: Pick<ISimpleDbEntityUtxoData, 'utxos'>;
//   market: Pick<ISimpleDbEntityMarktData, 'favorites'>;
// };

import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';

type IBackupBasicData = {
  contacts: Record<
    string,
    { name: string; address: string; networkId: string }
  >;
  discoverBookmarks?: IBrowserBookmark[];
};

export type IPublicBackupData = IBackupBasicData & {
  importedAccounts: Record<string, { name: string }>;
  watchingAccounts: Record<string, { name: string }>;
  HDWallets: Record<
    string,
    {
      name: string;
      avatar?: IAvatarInfo;
      accountUUIDs: Array<string>;
    }
  >;
  // simpleDb?: ISimpleDBBackUp;

  // browserHistories?: UserBrowserHistory[];
};

export type IBackupData = {
  privateData: string;
  publicData: IPublicBackupData;
  appVersion: string;
};

export enum ERestoreResult {
  SUCCESS = 'success',
  WRONG_PASSWORD = 'wrong_password',
  UNKNOWN_ERROR = 'unknown_error',
}

type IHasVersion = {
  version: number;
};

export type IImportableHDWallet = Omit<
  IDBWallet,
  | 'backuped'
  | 'accounts'
  | 'associatedDevice'
  | 'deviceType'
  | 'nextIndex'
  | 'walletNo'
  | 'avatar'
> & {
  accounts: Array<IDBAccount>;
  accountIds: Array<string>; // UUIDs of accounts
  avatar?: IAvatarInfo;
} & IHasVersion;

export type IPrivateBackupData = IBackupBasicData & {
  // WalletID/ImportedAccountID -> encrypted credential
  credentials: Record<string, string>;
  // UUID -> DBAccount
  importedAccounts: Record<string, IDBAccount & IHasVersion>;
  // UUID -> DBAccount
  watchingAccounts: Record<string, IDBAccount & IHasVersion>;
  // UUID -> ImportableHDWallet
  wallets: Record<string, IImportableHDWallet>;
  // simpleDb?: {
  //   utxoAccounts?: ISimpleDbEntityUtxoData;
  //   market?: ISimpleDbEntityMarktData;
  // };
};

export type IMetaDataObject = {
  filename: string;
  isManualBackup: boolean;
  deviceInfo: { deviceName: string; osName: string };
  backupTime: number;
  appVersion: string | undefined;
  walletCount: number;
  accountCount: number;
};
