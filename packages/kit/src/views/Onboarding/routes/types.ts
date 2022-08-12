import { SearchDevice } from '@onekeyhq/kit/src/utils/hardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { EOnboardingRoutes } from './enums';

export type IOnboardingRecoveryPhraseParams = {
  password: string;
  withEnableAuthentication?: boolean;
  mnemonic: string;
};
export type IOnboardingBehindTheSceneParams =
  IOnboardingRecoveryPhraseParams & {
    isHardwareCreating?: {
      device: SearchDevice;
      features: IOneKeyDeviceFeatures;
    };
  };
export type IOnboardingSetPasswordParams = {
  mnemonic?: string;
};
export type IOnboardingRoutesParams = {
  [EOnboardingRoutes.Welcome]: undefined;

  [EOnboardingRoutes.ConnectWallet]: undefined;
  [EOnboardingRoutes.ConnectHardwareModal]: undefined;

  [EOnboardingRoutes.ImportWallet]: undefined;

  [EOnboardingRoutes.SetPassword]: IOnboardingSetPasswordParams | undefined;
  [EOnboardingRoutes.RecoveryPhrase]: IOnboardingRecoveryPhraseParams;
  [EOnboardingRoutes.ShowRecoveryPhrase]: IOnboardingRecoveryPhraseParams;
  [EOnboardingRoutes.BehindTheScene]: IOnboardingBehindTheSceneParams;

  [EOnboardingRoutes.RestoreFromCloud]: undefined;
  [EOnboardingRoutes.CloudBackupDetails]: {
    backupUUID: string;
    backupTime: number;
    numOfHDWallets: number;
    numOfImportedAccounts: number;
    numOfWatchingAccounts: number;
    numOfContacts: number;
  };
};
