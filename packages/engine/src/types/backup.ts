import type { ISimpleDbEntityMarktData } from '../dbs/simple/entity/SimpleDbEntityMarket';
import type { ISimpleDbEntityUtxoData } from '../dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import type { DBAccount } from './account';
import type { Wallet } from './wallet';

// If version is not the same with the current supported version, we cannot
// directly write data into database, should use addAccount/addWallet methods
// instead then.
type HasVersion = {
  version: number;
};

export type ImportableHDWallet = Omit<
  Wallet,
  'backuped' | 'accounts' | 'associatedDevice' | 'deviceType'
> & {
  accounts: Array<DBAccount>;
  accountIds: Array<string>; // UUIDs of accounts
} & HasVersion;

export type BackupObject = {
  // WalletID/ImportedAccountID -> encrypted credential
  credentials: Record<string, string>;
  // UUID -> DBAccount
  importedAccounts: Record<string, DBAccount & HasVersion>;
  // UUID -> DBAccount
  watchingAccounts: Record<string, DBAccount & HasVersion>;
  // UUID -> ImportableHDWallet
  wallets: Record<string, ImportableHDWallet>;
  simpleDb?: {
    utxoAccounts?: ISimpleDbEntityUtxoData;
    market?: ISimpleDbEntityMarktData;
  };
};
