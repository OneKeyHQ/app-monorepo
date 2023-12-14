import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import {
  BeforeShowRecoveryPhrase,
  OneKeyHardwareWallet,
  GetStarted,
  ImportAddress,
  ImportPrivateKey,
  ImportRecoveryPhrase,
  RecoveryPhrase,
  LookingForDevices,
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
  {
    name: EOnboardingPages.BeforeShowRecoveryPhrase,
    component: BeforeShowRecoveryPhrase,
  },
  {
    name: EOnboardingPages.RecoveryPhrase,
    component: RecoveryPhrase,
  },
  {
    name: EOnboardingPages.ImportRecoveryPhrase,
    component: ImportRecoveryPhrase,
  },
  {
    name: EOnboardingPages.OneKeyHardwareWallet,
    component: OneKeyHardwareWallet,
  },
  {
    name: EOnboardingPages.LookingForDevices,
    component: LookingForDevices,
  },
  {
    name: EOnboardingPages.ImportPrivateKey,
    component: ImportPrivateKey,
  },
  {
    name: EOnboardingPages.ImportAddress,
    component: ImportAddress,
  },
];
