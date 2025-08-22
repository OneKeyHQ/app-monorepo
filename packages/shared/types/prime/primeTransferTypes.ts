// import type { ISimpleDbEntityMarktData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityMarket';
// import type { ISimpleDbEntityUtxoData } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type {
  IDBAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
// export type ISimpleDBBackUp = {
//   utxoAccounts: Pick<ISimpleDbEntityUtxoData, 'utxos'>;
//   market: Pick<ISimpleDbEntityMarktData, 'favorites'>;
// };
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';

export enum EPrimeTransferServerType {
  OFFICIAL = 'official',
  CUSTOM = 'custom',
}

type IHasVersion = {
  version: number;
};

export type IPrimeTransferHDWallet = Omit<
  IDBWallet,
  | 'accounts'
  | 'associatedDevice'
  | 'deviceType'
  | 'nextIndex'
  | 'walletNo'
  | 'avatar'
> & {
  accounts: Array<IDBAccount>;
  accountIds: Array<string>; // UUIDs of accounts
  indexedAccountUUIDs: Array<string>;
  avatarInfo?: IAvatarInfo;
} & IHasVersion;

export type IPrimeTransferAccount = IDBAccount & IHasVersion;

export type IPrimeTransferPrivateData = {
  // WalletID/ImportedAccountID -> encrypted credential
  credentials: Record<string, string>;
  // UUID -> DBAccount
  importedAccounts: Record<string, IPrimeTransferAccount>;
  // UUID -> DBAccount
  watchingAccounts: Record<string, IPrimeTransferAccount>;
  // UUID -> ImportableHDWallet
  wallets: Record<string, IPrimeTransferHDWallet>;
  // simpleDb?: {
  //   utxoAccounts?: ISimpleDbEntityUtxoData;
  //   market?: ISimpleDbEntityMarktData;
  // };
};

export type IPrimeTransferData = {
  privateData: IPrimeTransferPrivateData;
  isEmptyData: boolean;
  isWatchingOnly: boolean;
  appVersion: string;
};

export type IPrimeTransferSelectedItemMapInfo = {
  [id: string]: {
    checked: boolean;
    disabled: boolean;
  };
};
export type IPrimeTransferSelectedItemMap = {
  wallet: IPrimeTransferSelectedItemMapInfo;
  importedAccount: IPrimeTransferSelectedItemMapInfo;
  watchingAccount: IPrimeTransferSelectedItemMapInfo;
};

export type IPrimeTransferSelectedDataItem<T> = {
  item: T;
  credential?: string;
  tonMnemonicCredential?: string;
  id: string;
};
export type IPrimeTransferSelectedData = {
  wallets: IPrimeTransferSelectedDataItem<IPrimeTransferHDWallet>[];
  importedAccounts: IPrimeTransferSelectedDataItem<IPrimeTransferAccount>[];
  watchingAccounts: IPrimeTransferSelectedDataItem<IPrimeTransferAccount>[];
};

export interface IE2EESocketUserInfo {
  id: string;
  socketId: string | undefined;
  joinedAt: Date;
  appPlatform: string;
  appPlatformName: string;
  appVersion: string;
  appBuildNumber: string;
  appDeviceName: string;
}
