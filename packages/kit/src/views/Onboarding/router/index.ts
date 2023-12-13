import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';

import {
  ConnectHardwareWallet,
  GetStarted,
  ImportRecoveryPhrase,
  ShowRecoveryPhrase,
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
    name: EOnboardingPages.ShowRecoveryPhrase,
    component: ShowRecoveryPhrase,
  },
  {
    name: EOnboardingPages.ImportRecoveryPhrase,
    component: ImportRecoveryPhrase,
  },
  {
    name: EOnboardingPages.ConnectHardwareWallet,
    component: ConnectHardwareWallet,
  },
];
