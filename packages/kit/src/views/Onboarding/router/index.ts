import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

import { EOnboardingPages } from './type';

import type { IOnboardingParamList } from './type';

const ActivateDevice = LazyLoad(
  () => import('../pages/ConnectHardwareWallet/ActivateDevice'),
);

const ConnectYourDevice = LazyLoad(
  () => import('../pages/ConnectHardwareWallet/ConnectYourDevice'),
);

const OneKeyHardwareWallet = LazyLoad(
  () => import('../pages/ConnectHardwareWallet/OneKeyHardwareWallet'),
);

const BeforeShowRecoveryPhrase = LazyLoad(
  () => import('../pages/CreateWalet/BeforeShowRecoveryPhrase'),
);

const RecoveryPhrase = LazyLoad(
  () => import('../pages/CreateWalet/RecoveryPhrase'),
);

const VerifyRecoveryPhrase = LazyLoad(
  () => import('../pages/CreateWalet/VerifyRecoverPhrase'),
);

const ConnectWallet = LazyLoad(() => import('../pages/ConnectWallet'));
const FinalizeWalletSetup = LazyLoad(
  () => import('../pages/FinalizeWalletSetup'),
);
const GetStarted = LazyLoad(() => import('../pages/GetStarted'));

const ImportAddress = LazyLoad(
  () => import('../pages/ImportWallet/ImportAddress'),
);

const ImportPrivateKey = LazyLoad(
  () => import('../pages/ImportWallet/ImportPrivateKey'),
);

const ImportRecoveryPhrase = LazyLoad(
  () => import('../pages/ImportWallet/ImportRecoveryPhrase'),
);

const ImportWalletOptions = LazyLoad(
  () => import('../pages/ImportWallet/ImportWalletOptions'),
);

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
  {
    name: EOnboardingPages.VerifyRecoverPhrase,
    component: VerifyRecoveryPhrase,
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
