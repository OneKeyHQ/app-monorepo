import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';

export enum EModalKeyTagRoutes {
  UserOptions = 'Options',
  BackupWallet = 'BackupWallet',
  BackupDotMap = 'BackupDotMap',
  BackupRecoveryPhrase = 'BackupRecoveryPhrase',
  BackupDocs = 'BackupDocs',
}

export type IModalKeyTagParamList = {
  [EModalKeyTagRoutes.UserOptions]: undefined;
  [EModalKeyTagRoutes.BackupRecoveryPhrase]: undefined;
  [EModalKeyTagRoutes.BackupWallet]: undefined;
  [EModalKeyTagRoutes.BackupDotMap]: {
    wallet?: IDBWallet;
    encodedText: string;
    title: string;
  };
  [EModalKeyTagRoutes.BackupDocs]: undefined;
};
