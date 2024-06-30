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
export type IV4OnAccountMigrated = (
  v5account: IDBAccount,
  v4account: IV4DBAccount,
) => Promise<void>;
export type IV4OnWalletMigrated = (v5wallet: IDBWallet) => Promise<void>;
export type IV4RunWalletMigrationParams = {
  onWalletMigrated: IV4OnWalletMigrated;
  onAccountMigrated: IV4OnAccountMigrated;
  v4wallet: IV4DBWallet;
  isResumeMode: boolean;
};

export type IV4RunAccountMigrationParams = {
  onAccountMigrated: IV4OnAccountMigrated;
  v4account: IV4DBAccount;
};

export type IV4MigrationPayload = {
  v5password: string;
  v4password: string;
  isV4PasswordEqualToV5: boolean | 'not-set';
  migrateV4PasswordOk: boolean;
  migrateV4SecurePasswordOk: boolean;
  shouldBackup: boolean;
  wallets: IV4MigrationWallet[];
  walletsForBackup: IV4MigrationWallet[];
  totalWalletsAndAccounts: number;
  isAutoStartOnMount: boolean;
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
  networkId?: string;
};
export type IV4MigrationBackupSectionDataItem = {
  title: string;
  data: Array<IV4MigrationBackupItem>;
};
export type IV4MigrationBackupSectionData =
  Array<IV4MigrationBackupSectionDataItem>;
