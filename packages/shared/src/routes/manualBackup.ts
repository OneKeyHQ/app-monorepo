import type { EOnboardingPages } from './onboarding';

export enum EManualBackupRoutes {
  ManualBackupSelectWallet = 'ManualBackupSelectWallet',
}

export type IManualBackupParamList = {
  [EManualBackupRoutes.ManualBackupSelectWallet]: undefined;
  [EOnboardingPages.BeforeShowRecoveryPhrase]: {
    mnemonic?: string;
    isBackup?: boolean;
    isWalletBackedUp?: boolean;
    walletId?: string;
  };
  [EOnboardingPages.RecoveryPhrase]: {
    mnemonic?: string;
    isBackup?: boolean;
    isWalletBackedUp?: boolean;
    walletId?: string;
  };
  [EOnboardingPages.VerifyRecoverPhrase]: {
    mnemonic: string;
    verifyRecoveryPhrases?: string[][][];
    isBackup?: boolean;
    isWalletBackedUp?: boolean;
    walletId?: string;
  };
};
