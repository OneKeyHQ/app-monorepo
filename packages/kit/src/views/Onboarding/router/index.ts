import type { IModalFlowNavigatorConfig } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';

const ActivateDevice = LazyLoadPage(
  () => import('../pages/ConnectHardwareWallet/ActivateDevice'),
);

const ConnectYourDevice = LazyLoadPage(
  () => import('../pages/ConnectHardwareWallet/ConnectYourDevice'),
);

const OneKeyHardwareWallet = LazyLoadPage(
  () => import('../pages/ConnectHardwareWallet/OneKeyHardwareWallet'),
);

const BeforeShowRecoveryPhrase = LazyLoadPage(
  () => import('../pages/CreateWalet/BeforeShowRecoveryPhrase'),
);

const RecoveryPhrase = LazyLoadPage(
  () => import('../pages/CreateWalet/RecoveryPhrase'),
);

const VerifyRecoveryPhrase = LazyLoadPage(
  () => import('../pages/CreateWalet/VerifyRecoverPhrase'),
);

const ConnectWallet = LazyLoadPage(() => import('../pages/ConnectWallet'));
const FinalizeWalletSetup = LazyLoadPage(
  () => import('../pages/FinalizeWalletSetup'),
);
const GetStarted = LazyLoadPage(() => import('../pages/GetStarted'));

const ImportAddress = LazyLoadPage(
  () => import('../pages/ImportWallet/ImportAddress'),
);

const ImportPrivateKey = LazyLoadPage(
  () => import('../pages/ImportWallet/ImportPrivateKey'),
);

const ImportRecoveryPhrase = LazyLoadPage(
  () => import('../pages/ImportWallet/ImportRecoveryPhrase'),
);

const ImportWalletOptions = LazyLoadPage(
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
    shouldPopOnClickBackdrop: true,
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
