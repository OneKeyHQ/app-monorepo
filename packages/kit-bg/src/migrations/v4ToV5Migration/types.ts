import type { IServerNetwork } from '@onekeyhq/shared/types';

import type {
  IV4DBAccount,
  IV4DBHdCredentialRaw,
  IV4DBImportedCredentialRaw,
  IV4DBWallet,
} from './v4local/v4localDBTypes';
import type { IDBAccount, IDBWallet } from '../../dbs/local/types';

export type IV4MigrationWallet = {
  wallet: IV4DBWallet;
  isHD: boolean;
  isHw: boolean;
  isImported: boolean;
  isWatching: boolean;
  isExternal: boolean;
  //   accounts: IV4DBAccount[];
};

export type IV4RunWalletMigrationParams = {
  onWalletMigrated: (v5wallet?: IDBWallet) => void;
  onAccountMigrated: (v5account?: IDBAccount) => void;
  v4wallet: IV4DBWallet;
};

export type IV4RunAccountMigrationParams = {
  onAccountMigrated: (v5account: IDBAccount) => void;
  v4account: IV4DBAccount;
};

export type IV4MigrationPayload = {
  password: string;
  v4password: string;
  migratePasswordOk: boolean;
  shouldBackup: boolean;
  wallets: IV4MigrationWallet[];
  walletsForBackup: IV4MigrationWallet[];
  totalWalletsAndAccounts: number;
};

export type IV4MigrationHdCredential = {
  mnemonic: string;
  wallet: IV4DBWallet;
  dbCredentialRaw: IV4DBHdCredentialRaw;
};
export type IV4MigrationImportedCredential = {
  privateKey: string;
  exportedPrivateKey: string;
  account: IV4DBAccount;
  dbCredentialRaw: IV4DBImportedCredentialRaw;
};

export type IV4MigrationBackupItem = {
  backupId: string;
  title: string;
  subTitle: string;
  hdWallet?: IV4DBWallet;
  importedAccount?: IV4DBAccount;
  network?: IServerNetwork;
};
export type IV4MigrationBackupSectionDataItem = {
  title: string;
  data: Array<IV4MigrationBackupItem>;
};
export type IV4MigrationBackupSectionData =
  Array<IV4MigrationBackupSectionDataItem>;
