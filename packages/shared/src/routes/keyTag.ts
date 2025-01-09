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
  [EModalKeyTagRoutes.BackupDotMap]: { encodedText: string; title: string };
  [EModalKeyTagRoutes.BackupDocs]: undefined;
};
