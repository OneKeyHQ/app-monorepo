import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import {
  ActivateDevice,
  BeforeShowRecoveryPhrase,
  ConnectWallet,
  ConnectYourDevice,
  FinalizeWalletSetup,
  GetStarted,
  ImportAddress,
  ImportPrivateKey,
  ImportRecoveryPhrase,
  ImportWalletOptions,
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
    name: EOnboardingPages.ImportWalletOptions,
    component: ImportWalletOptions,
  },
  {
    name: EOnboardingPages.ImportRecoveryPhrase,
    component: ImportRecoveryPhrase,
  },
  {
    name: EOnboardingPages.ImportPrivateKey,
    component: ImportPrivateKey,
  },
  {
    name: EOnboardingPages.ImportAddress,
    component: ImportAddress,
  },

  // connect 3rd-party wallet
  {
    name: EOnboardingPages.ConnectWallet,
    component: ConnectWallet,
  },

  // finalize wallet setup
  {
    name: EOnboardingPages.FinalizeWalletSetup,
    component: FinalizeWalletSetup,
  },
];
