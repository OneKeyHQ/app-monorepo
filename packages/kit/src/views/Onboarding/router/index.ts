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
const ConnectWalletSelectNetworks = LazyLoadPage(
  () => import('../pages/ConnectWalletSelectNetworks'),
);
const FinalizeWalletSetup = LazyLoadPage(
  () => import('../pages/FinalizeWalletSetup'),
);

const GetStarted = LazyLoadPage(() => import('../pages/GetStarted'));

const V4MigrationGetStarted = LazyLoadPage(
  () => import('../pages/V4Migration/V4MigrationGetStarted'),
);

const V4MigrationPreview = LazyLoadPage(
  () => import('../pages/V4Migration/V4MigrationPreview'),
);

const V4MigrationProcess = LazyLoadPage(
  () => import('../pages/V4Migration/V4MigrationProcess'),
);

const V4MigrationDone = LazyLoadPage(
  () => import('../pages/V4Migration/V4MigrationDone'),
);

const ImportAddress = LazyLoadPage(
  () => import('../pages/ImportWallet/ImportAddress'),
);
const ImportCloudBackup = LazyLoadPage(
  () => import('../pages/ImportWallet/ImportCloudBackup'),
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

const ImportKeyTag = LazyLoadPage(
  () => import('../pages/ImportWallet/ImportKeyTag'),
);

export const OnboardingRouter: IModalFlowNavigatorConfig<
  EOnboardingPages,
  IOnboardingParamList
>[] = [
  {
    name: EOnboardingPages.GetStarted,
    component: GetStarted,
  },

  // v4 migration
  {
    name: EOnboardingPages.V4MigrationGetStarted,
    component: V4MigrationGetStarted,
  },
  {
    name: EOnboardingPages.V4MigrationPreview,
    component: V4MigrationPreview,
  },
  {
    name: EOnboardingPages.V4MigrationProcess,
    component: V4MigrationProcess,
  },
  {
    name: EOnboardingPages.V4MigrationDone,
    component: V4MigrationDone,
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
    name: EOnboardingPages.ImportKeyTag,
    component: ImportKeyTag,
  },
  {
    name: EOnboardingPages.ImportPrivateKey,
    component: ImportPrivateKey,
  },
  {
    name: EOnboardingPages.ImportAddress,
    component: ImportAddress,
  },
  {
    name: EOnboardingPages.ImportCloudBackup,
    component: ImportCloudBackup,
  },

  // connect 3rd-party wallet
  {
    name: EOnboardingPages.ConnectWallet,
    component: ConnectWallet,
  },
  {
    name: EOnboardingPages.ConnectWalletSelectNetworks,
    component: ConnectWalletSelectNetworks,
  },

  // finalize wallet setup
  {
    name: EOnboardingPages.FinalizeWalletSetup,
    component: FinalizeWalletSetup,
    allowDisableClose: true,
  },
];
