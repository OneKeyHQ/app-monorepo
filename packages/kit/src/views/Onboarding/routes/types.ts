import type { MigrateData } from '@onekeyhq/engine/src/types/migrate';
import type { SearchDevice } from '@onekeyhq/kit/src/utils/hardware';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import type { EOnboardingRoutes } from './enums';

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
  disableAnimation?: boolean;
  mnemonic?: string;
};
export type IOnboardingConnectWalletParams = {
  disableAnimation?: boolean;
  disableOnboardingDone?: boolean;
  onSuccess?: () => void;
};
export type IOnboardingImportWalletParams = {
  disableAnimation?: boolean;
};

export type IOnboardingWelcomeParams = {
  disableAnimation?: boolean;
};

export type IOnboardingRoutesParams = {
  [EOnboardingRoutes.Welcome]: IOnboardingWelcomeParams | undefined;

  [EOnboardingRoutes.ConnectWallet]: IOnboardingConnectWalletParams | undefined;
  [EOnboardingRoutes.ConnectHardwareModal]: undefined;
  [EOnboardingRoutes.ThirdPartyWallet]:
    | IOnboardingConnectWalletParams
    | undefined;

  [EOnboardingRoutes.ImportWallet]: IOnboardingImportWalletParams | undefined;
  [EOnboardingRoutes.RecoveryWallet]: undefined;

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
  [EOnboardingRoutes.KeyTag]: undefined;
  [EOnboardingRoutes.Migration]: undefined;
  [EOnboardingRoutes.MigrationPreview]: {
    data: MigrateData;
  };
};
