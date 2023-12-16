import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import {
  ActivateDevice,
  BeforeShowRecoveryPhrase,
  ConnectYourDevice,
  FinalizeWalletSetup,
  GetStarted,
  ImportAddress,
  ImportPrivateKey,
  ImportRecoveryPhrase,
  OneKeyHardwareWallet,
  RecoveryPhrase,
} from '../pages';

import { EOnboardingPages } from './type';

import type { IOnboardingParamList } from './type';

export const OnboardingRouter: IModalFlowNavigatorConfig<
  EOnboardingPages,
  IOnboardingParamList
>[] = [
  {
    name: EOnboardingPages.GetStarted,
    component: GetStarted,
  },

  // connect hardware wallet
  {
    name: EOnboardingPages.ConnectYourDevice,
    component: ConnectYourDevice,
  },
  {
    name: EOnboardingPages.OneKeyHardwareWallet,
    component: OneKeyHardwareWallet,
  },
  {
    name: EOnboardingPages.ActivateDevice,
    component: ActivateDevice,
  },

  // create wallet
  {
    name: EOnboardingPages.BeforeShowRecoveryPhrase,
    component: BeforeShowRecoveryPhrase,
  },
  {
    name: EOnboardingPages.RecoveryPhrase,
    component: RecoveryPhrase,
  },

  // import wallet
  {
    name: EOnboardingPages.ImportRecoveryPhrase,
    component: ImportRecoveryPhrase,
  },

  // import private key
  {
    name: EOnboardingPages.ImportPrivateKey,
    component: ImportPrivateKey,
  },

  // import address
  {
    name: EOnboardingPages.ImportAddress,
    component: ImportAddress,
  },

  // finalize wallet setup
  {
    name: EOnboardingPages.FinalizeWalletSetup,
    component: FinalizeWalletSetup,
  },
];
