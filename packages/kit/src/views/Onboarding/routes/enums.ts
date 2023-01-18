export enum EOnboardingRoutes {
  Welcome = 'welcome',

  // ConnectWallet
  ConnectWallet = 'ConnectWallet',
  ConnectHardwareModal = 'ConnectHardwareModal',

  // ImportWallet
  ImportWallet = 'ImportWallet',

  // CreateWallet
  SetPassword = 'SetPassword',
  RecoveryPhrase = 'RecoveryPhrase', // RecoveryPhrase tips
  ShowRecoveryPhrase = 'ShowRecoveryPhrase', // RecoveryPhrase 12/24 words
  BehindTheScene = 'BehindTheScene', // Auto-typing

  // Restore from cloud backup
  RestoreFromCloud = 'RestoreFromCloud',
  CloudBackupDetails = 'CloudBackupDetails',

  Migration = 'Migration',
  MigrationPreview = 'MigrationPreview',
}
