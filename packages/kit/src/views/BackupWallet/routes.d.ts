export type BackupType = 'iCloud' | 'OnekeyLite' | 'Manual' | 'showMnemonics';

export enum BackupWalletModalRoutes {
  BackupWalletModal = 'BackupWalletModal',
  BackupWalletAuthorityVerifyModal = 'BackupWalletAuthorityVerifyModal',
  BackupWalletManualHintModal = 'BackupWalletManualHintModal',
  BackupWalletWarningModal = 'BackupWalletWarningModal',
  BackupShowMnemonicsModal = 'BackupShowMnemonicsModal',
  BackupWalletMnemonicsVerifyModal = 'BackupWalletMnemonicsVerifyModal',
  BackupWalletManualSuccessModal = 'BackupWalletManualSuccessModal',
}

export type BackupWalletRoutesParams = {
  [BackupWalletModalRoutes.BackupWalletModal]: {
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletAuthorityVerifyModal]: {
    walletId: string;
    backupType: BackupType;
  };
  [BackupWalletModalRoutes.BackupWalletManualHintModal]: {
    backup: string;
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletWarningModal]: {
    backup: string;
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupShowMnemonicsModal]: {
    backup: string;
    readOnly: boolean;
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletMnemonicsVerifyModal]: {
    mnemonics: string[];
    walletId: string;
  };
  [BackupWalletModalRoutes.BackupWalletManualSuccessModal]: {
    walletId: string | null;
  };
};
