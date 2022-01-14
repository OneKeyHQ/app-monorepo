export enum BackupWalletModalRoutes {
  BackupSeedHintModal = 'BackupSeedHintModal',
  BackupMnemonicsModal = 'BackupMnemonicsModal',
}

export type BackupWalletRoutesParams = {
  [BackupWalletModalRoutes.BackupSeedHintModal]: undefined;
  [BackupWalletModalRoutes.BackupMnemonicsModal]: undefined;
};
