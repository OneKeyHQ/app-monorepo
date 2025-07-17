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
  appVersion: string;
};

export type IPrimeTransferSelectedItemMapInfo = {
  [id: string]: boolean;
};
export type IPrimeTransferSelectedItemMap = {
  wallet: IPrimeTransferSelectedItemMapInfo;
  importedAccount: IPrimeTransferSelectedItemMapInfo;
  watchingAccount: IPrimeTransferSelectedItemMapInfo;
};

export type IPrimeTransferSelectedData = {
  wallets: {
    item: IPrimeTransferHDWallet;
    credential?: string;
    id: string;
  }[];
  importedAccounts: {
    item: IPrimeTransferAccount;
    credential?: string;
    id: string;
  }[];
  watchingAccounts: {
    item: IPrimeTransferAccount;
    id: string;
  }[];
};
